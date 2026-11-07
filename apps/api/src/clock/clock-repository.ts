import type { ClockPeriodView, WorkMode } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export interface StoredClockPeriod {
  id: number;
  startedAt: Date;
  endedAt: Date | null;
}

export interface StoredClockDay {
  id: number;
  workDate: string;
  workMode: WorkMode;
  periods: StoredClockPeriod[];
}

export function toClockPeriodView(period: StoredClockPeriod): ClockPeriodView {
  return {
    id: period.id,
    startedAt: period.startedAt.toISOString(),
    endedAt: period.endedAt?.toISOString() ?? null,
  };
}

export async function findClockDays(
  db: Kysely<Database>,
  userId: number,
  fromDate: string,
  toDate: string,
): Promise<Map<string, StoredClockDay>> {
  const rows = await db
    .selectFrom('clockDay')
    .leftJoin('clockPeriod', 'clockPeriod.clockDayId', 'clockDay.id')
    .select([
      'clockDay.id as dayId',
      'clockDay.workDate',
      'clockDay.workMode',
      'clockPeriod.id as periodId',
      'clockPeriod.startedAt',
      'clockPeriod.endedAt',
    ])
    .where('clockDay.userId', '=', userId)
    .where('clockDay.workDate', '>=', fromDate)
    .where('clockDay.workDate', '<=', toDate)
    .orderBy('clockDay.workDate')
    .orderBy('clockPeriod.startedAt')
    .execute();
  const days = new Map<string, StoredClockDay>();
  for (const row of rows) {
    let day = days.get(row.workDate);
    if (!day) {
      day = { id: row.dayId, workDate: row.workDate, workMode: row.workMode, periods: [] };
      days.set(row.workDate, day);
    }
    if (row.periodId !== null && row.startedAt !== null) {
      day.periods.push({ id: row.periodId, startedAt: row.startedAt, endedAt: row.endedAt });
    }
  }
  return days;
}
