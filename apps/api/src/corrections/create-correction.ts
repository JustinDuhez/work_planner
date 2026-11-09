import {
  addDays,
  canEditPastClock,
  correctionPeriodsOf,
  toWorkDate,
  truncateToMinute,
  ValidationError,
  type ClockCorrectionView,
  type CreateClockCorrectionRequest,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { findPeriodsOfDay, inClockTransaction } from '../clock/clock-repository';
import { markCorrectionNotificationsRead } from '../notifications/notification-repository';
import { notify } from '../notifications/notify';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
import {
  ClockCorrectionDayNotPastError,
  ClockCorrectionForbiddenError,
  correctionProblemError,
} from './correction-errors';
import {
  findClockCorrectionById,
  insertClockCorrectionRow,
  lockClockDay,
  replaceDayPeriods,
  setClockDayWorkMode,
  supersedePendingCorrection,
  toSnapshot,
} from './correction-repository';
import { toClockCorrectionView } from './correction-view';

function assertRealDate(date: string): void {
  // The schema checks the shape only; 2026-02-30 would roll over to March.
  if (addDays(date, 0) !== date) {
    throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
      date: 'Date invalide.',
    });
  }
}

export async function createClockCorrection(
  deps: ClockDependencies,
  command: { viewer: ClockViewer } & CreateClockCorrectionRequest,
): Promise<ClockCorrectionView> {
  const [owner, author] = await Promise.all([
    findActiveUserSummary(deps.db, command.userId),
    findActiveUserSummary(deps.db, command.viewer.id),
  ]);
  if (!owner || !author) throw new UserNotFoundError();
  if (!canEditPastClock(await command.viewer.loadActor(), owner.id))
    throw new ClockCorrectionForbiddenError();
  const now = truncateToMinute(deps.now());
  assertRealDate(command.date);
  if (command.date >= toWorkDate(now, deps.timeZone)) throw new ClockCorrectionDayNotPastError();
  const result = correctionPeriodsOf(command.date, command.periods, {
    timeZone: deps.timeZone,
    now,
  });
  if (!result.isValid) throw correctionProblemError(result.problem);
  // E5-D3: correcting one's own day needs nobody's consent.
  const isSelfCorrection = owner.id === author.id;

  const correctionId = await inClockTransaction(deps.db, async (trx) => {
    const day = await lockClockDay(trx, {
      userId: owner.id,
      workDate: command.date,
      workMode: command.workMode,
    });
    const beforePeriods = await findPeriodsOfDay(trx, day.id);
    await replaceDayPeriods(trx, day.id, result.periods);
    await setClockDayWorkMode(trx, day.id, command.workMode);
    const supersededId = await supersedePendingCorrection(trx, {
      userId: owner.id,
      workDate: command.date,
    });
    if (supersededId !== undefined) await markCorrectionNotificationsRead(trx, supersededId, now);
    const id = await insertClockCorrectionRow(trx, {
      userId: owner.id,
      workDate: command.date,
      authorId: author.id,
      beforeWorkMode: day.hadRecord ? day.workMode : null,
      afterWorkMode: command.workMode,
      beforePeriods: toSnapshot(beforePeriods),
      afterPeriods: toSnapshot(result.periods),
      comment: command.comment || null,
      status: isSelfCorrection ? 'accepted' : 'pending',
      respondedAt: isSelfCorrection ? now : null,
    });
    if (!isSelfCorrection) {
      await notify(trx, {
        userId: owner.id,
        type: 'clock_correction_received',
        payload: {
          correctionId: id,
          ownerId: owner.id,
          workDate: command.date,
          actorName: `${author.firstName} ${author.lastName}`,
        },
      });
    }
    return id;
  });
  const correction = await findClockCorrectionById(deps.db, correctionId);
  if (!correction) throw new Error(`Correction ${correctionId} vanished after its creation`);
  return toClockCorrectionView(correction, command.viewer.id);
}
