import {
  addDays,
  canResetCounter,
  toWorkDate,
  ValidationError,
  type CounterResetView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { UserNotFoundError } from '../users/user-errors';
import {
  CounterResetDateBeforeStartError,
  CounterResetDateInFutureError,
  CounterResetForbiddenError,
} from './counter-errors';
import {
  findCounterProfile,
  findCounterResetById,
  findCounterResets,
  insertCounterReset,
  toCounterResetView,
  type CounterProfile,
} from './counter-repository';

async function authorizedOwner(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; ownerId: number },
): Promise<CounterProfile> {
  const owner = await findCounterProfile(deps.db, query.ownerId);
  if (!owner) throw new UserNotFoundError();
  if (!canResetCounter(await query.viewer.loadActor(), owner.id)) {
    throw new CounterResetForbiddenError();
  }
  return owner;
}

function assertRealDate(date: string): void {
  // The schema checks the shape only; 2026-02-30 would roll over to March.
  if (addDays(date, 0) !== date) {
    throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
      resetDate: 'Date invalide.',
    });
  }
}

export async function createCounterReset(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; ownerId: number; resetDate?: string },
): Promise<CounterResetView> {
  const owner = await authorizedOwner(deps, command);
  const today = toWorkDate(deps.now(), deps.timeZone);
  const resetDate = command.resetDate ?? today;
  assertRealDate(resetDate);
  if (resetDate > today) throw new CounterResetDateInFutureError();
  if (resetDate < owner.startDate) throw new CounterResetDateBeforeStartError();
  const resetId = await insertCounterReset(deps.db, {
    userId: owner.id,
    resetDate,
    authorId: command.viewer.id,
  });
  return toCounterResetView(await findCounterResetById(deps.db, resetId));
}

export async function listCounterResets(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; ownerId: number },
): Promise<CounterResetView[]> {
  const owner = await authorizedOwner(deps, query);
  return (await findCounterResets(deps.db, owner.id)).map(toCounterResetView);
}
