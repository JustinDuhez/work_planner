import { dayWorkedMinutes, type ClockCorrectionView } from '@work-planner/domain';
import type { SnapshotPeriod } from '../db/database';
import type { StoredClockCorrection } from './correction-repository';

function snapshotMinutes(periods: readonly SnapshotPeriod[]): number {
  // Past days: an open period counts nothing until its end is set (E3).
  return dayWorkedMinutes(
    periods.map((period) => ({
      startedAt: new Date(period.startedAt),
      endedAt: period.endedAt === null ? null : new Date(period.endedAt),
    })),
    { now: new Date(0), isToday: false },
  );
}

export function toClockCorrectionView(
  correction: StoredClockCorrection,
  viewerId: number,
): ClockCorrectionView {
  const beforeMinutes = snapshotMinutes(correction.beforePeriods);
  const afterMinutes = snapshotMinutes(correction.afterPeriods);
  return {
    id: correction.id,
    user: correction.user,
    author: correction.author,
    workDate: correction.workDate,
    status: correction.status,
    comment: correction.comment,
    responseComment: correction.responseComment,
    createdAt: correction.createdAt.toISOString(),
    respondedAt: correction.respondedAt?.toISOString() ?? null,
    before: {
      workMode: correction.beforeWorkMode,
      periods: correction.beforePeriods,
      workedMinutes: beforeMinutes,
    },
    after: {
      workMode: correction.afterWorkMode,
      periods: correction.afterPeriods,
      workedMinutes: afterMinutes,
    },
    differenceMinutes: afterMinutes - beforeMinutes,
    canAnswer: correction.user.id === viewerId && correction.status === 'pending',
  };
}
