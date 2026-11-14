import {
  AppError,
  canResetCounter,
  ForbiddenError,
  toWorkDate,
  ValidationError,
  type CounterResetView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { assertRealDate } from '../http/real-date';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
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

function assertResettableDate(input: {
  owner: CounterProfile;
  resetDate: string;
  today: string;
}): void {
  if (input.resetDate > input.today) throw new CounterResetDateInFutureError();
  if (input.resetDate < input.owner.startDate) throw new CounterResetDateBeforeStartError();
}

/** F4.3b: the batch error says whose counter failed, keeping E4's code and status. */
function namingPerson(error: unknown, person: { firstName: string; lastName: string }): Error {
  if (!(error instanceof AppError)) {
    return error instanceof Error ? error : new Error('Unexpected error', { cause: error });
  }
  const message = `${error.message} (${person.firstName} ${person.lastName})`;
  if (error instanceof ValidationError) {
    return new ValidationError(error.code, message, error.fieldErrors);
  }
  if (error instanceof ForbiddenError) return new ForbiddenError(error.code, message);
  return error;
}

export async function createCounterReset(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; ownerId: number; resetDate?: string },
): Promise<CounterResetView> {
  const owner = await authorizedOwner(deps, command);
  const today = toWorkDate(deps.now(), deps.timeZone);
  const resetDate = command.resetDate ?? today;
  assertRealDate(resetDate, 'resetDate');
  assertResettableDate({ owner, resetDate, today });
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

export async function createCounterResets(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; userIds: readonly number[]; resetDate?: string },
): Promise<CounterResetView[]> {
  const actor = await command.viewer.loadActor();
  const today = toWorkDate(deps.now(), deps.timeZone);
  const resetDate = command.resetDate ?? today;
  assertRealDate(resetDate, 'resetDate');
  // All or nothing (E7-D5): the first refusal rolls back every reset already written.
  const resetIds = await deps.db.transaction().execute(async (trx) => {
    const ids: number[] = [];
    for (const userId of command.userIds) {
      const [owner, person] = await Promise.all([
        findCounterProfile(trx, userId),
        findActiveUserSummary(trx, userId),
      ]);
      if (!owner || !person) throw new UserNotFoundError();
      try {
        if (!canResetCounter(actor, owner.id)) throw new CounterResetForbiddenError();
        assertResettableDate({ owner, resetDate, today });
      } catch (error) {
        throw namingPerson(error, person);
      }
      ids.push(
        await insertCounterReset(trx, { userId: owner.id, resetDate, authorId: command.viewer.id }),
      );
    }
    return ids;
  });
  return Promise.all(
    resetIds.map(async (id) => toCounterResetView(await findCounterResetById(deps.db, id))),
  );
}
