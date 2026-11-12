import type { DayTypeView, Half } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export interface PlannedHalfDayRow {
  workDate: string;
  half: Half;
  dayTypeCode: string;
  isBadgeable: boolean;
  status: 'pending' | 'approved';
}

export function findDayTypes(db: Kysely<Database>): Promise<DayTypeView[]> {
  return db
    .selectFrom('dayType')
    .select(['code', 'label', 'color', 'requiresApproval', 'isBadgeable', 'isRequestable'])
    .orderBy('id')
    .execute();
}

/** Only pending and approved requests keep half-day rows (refusal and cancellation delete them). */
export async function findPlannedHalfDays(
  db: Kysely<Database>,
  query: { userId: number; fromDate: string; toDate: string },
): Promise<PlannedHalfDayRow[]> {
  const rows = await db
    .selectFrom('halfDay')
    .innerJoin('dayType', 'dayType.id', 'halfDay.dayTypeId')
    .innerJoin('leaveRequest', 'leaveRequest.id', 'halfDay.leaveRequestId')
    .select([
      'halfDay.workDate',
      'halfDay.half',
      'dayType.code as dayTypeCode',
      'dayType.isBadgeable',
      'leaveRequest.status',
    ])
    .where('halfDay.userId', '=', query.userId)
    .where('halfDay.workDate', '>=', query.fromDate)
    .where('halfDay.workDate', '<=', query.toDate)
    .orderBy('halfDay.workDate')
    .execute();
  return rows.map((row) => ({
    ...row,
    status: row.status === 'approved' ? 'approved' : 'pending',
  }));
}

export async function hasApprovedTelework(
  db: Kysely<Database>,
  userId: number,
  date: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('halfDay')
    .innerJoin('dayType', 'dayType.id', 'halfDay.dayTypeId')
    .innerJoin('leaveRequest', 'leaveRequest.id', 'halfDay.leaveRequestId')
    .select('halfDay.id')
    .where('halfDay.userId', '=', userId)
    .where('halfDay.workDate', '=', date)
    .where('dayType.code', '=', 'telework')
    .where('leaveRequest.status', '=', 'approved')
    .limit(1)
    .executeTakeFirst();
  return row !== undefined;
}
