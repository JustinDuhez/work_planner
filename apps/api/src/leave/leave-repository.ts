import type {
  CalendarHalfDay,
  DayTypeView,
  Half,
  HalfDaySlot,
  LeaveStatus,
  TeamMonthHalfDay,
} from '@work-planner/domain';
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

export interface LeaveRequestRow {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  dayTypeCode: string;
  dayTypeLabel: string;
  startDate: string;
  startHalf: Half;
  endDate: string;
  endHalf: Half;
  halfDayCount: number;
  status: LeaveStatus;
  reason: string | null;
  ruleNote: string | null;
  isAutoApproved: boolean;
  authorId: number;
  authorFirstName: string;
  authorLastName: string;
  reviewerId: number | null;
  reviewerFirstName: string | null;
  reviewerLastName: string | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export function selectLeaveRequests(db: Kysely<Database>) {
  return db
    .selectFrom('leaveRequest')
    .innerJoin('appUser as requester', 'requester.id', 'leaveRequest.userId')
    .innerJoin('dayType', 'dayType.id', 'leaveRequest.dayTypeId')
    .innerJoin('appUser as author', 'author.id', 'leaveRequest.authorId')
    .leftJoin('appUser as reviewer', 'reviewer.id', 'leaveRequest.reviewerId')
    .select([
      'leaveRequest.id',
      'leaveRequest.userId',
      'requester.firstName',
      'requester.lastName',
      'dayType.code as dayTypeCode',
      'dayType.label as dayTypeLabel',
      'leaveRequest.startDate',
      'leaveRequest.startHalf',
      'leaveRequest.endDate',
      'leaveRequest.endHalf',
      'leaveRequest.halfDayCount',
      'leaveRequest.status',
      'leaveRequest.reason',
      'leaveRequest.ruleNote',
      'leaveRequest.isAutoApproved',
      'leaveRequest.authorId',
      'author.firstName as authorFirstName',
      'author.lastName as authorLastName',
      'leaveRequest.reviewerId',
      'reviewer.firstName as reviewerFirstName',
      'reviewer.lastName as reviewerLastName',
      'leaveRequest.reviewComment',
      'leaveRequest.reviewedAt',
      'leaveRequest.createdAt',
    ]);
}

export async function findLeaveRequestById(
  db: Kysely<Database>,
  requestId: number,
): Promise<LeaveRequestRow | undefined> {
  return selectLeaveRequests(db).where('leaveRequest.id', '=', requestId).executeTakeFirst();
}

/** Every pending or approved half-day of a person in a date range, as slots. */
export async function findTakenSlots(
  db: Kysely<Database>,
  query: { userId: number; fromDate: string; toDate: string },
): Promise<HalfDaySlot[]> {
  const rows = await db
    .selectFrom('halfDay')
    .select(['workDate', 'half'])
    .where('userId', '=', query.userId)
    .where('workDate', '>=', query.fromDate)
    .where('workDate', '<=', query.toDate)
    .orderBy('workDate')
    .orderBy('half')
    .execute();
  return rows.map((row) => ({ date: row.workDate, half: row.half }));
}

function calendarHalfDayRows(db: Kysely<Database>, range: { fromDate: string; toDate: string }) {
  return db
    .selectFrom('halfDay')
    .innerJoin('dayType', 'dayType.id', 'halfDay.dayTypeId')
    .innerJoin('leaveRequest', 'leaveRequest.id', 'halfDay.leaveRequestId')
    .select([
      'halfDay.userId',
      'halfDay.workDate',
      'halfDay.half',
      'dayType.code as dayTypeCode',
      'leaveRequest.status',
      'halfDay.leaveRequestId',
    ])
    .where('halfDay.workDate', '>=', range.fromDate)
    .where('halfDay.workDate', '<=', range.toDate)
    .orderBy('halfDay.workDate')
    .orderBy('halfDay.half');
}

// Refused / cancelled requests keep no half-days: what is left is pending or approved.
const liveStatus = (status: LeaveStatus): 'pending' | 'approved' =>
  status === 'approved' ? 'approved' : 'pending';

export async function findCalendarHalfDays(
  db: Kysely<Database>,
  query: { userId: number; fromDate: string; toDate: string },
): Promise<CalendarHalfDay[]> {
  const rows = await calendarHalfDayRows(db, query)
    .where('halfDay.userId', '=', query.userId)
    .execute();
  return rows.map((row) => ({
    date: row.workDate,
    half: row.half,
    dayTypeCode: row.dayTypeCode,
    status: liveStatus(row.status),
    leaveRequestId: row.leaveRequestId,
  }));
}

export async function findMonthHalfDays(
  db: Kysely<Database>,
  range: { fromDate: string; toDate: string },
): Promise<(TeamMonthHalfDay & { userId: number })[]> {
  const rows = await calendarHalfDayRows(db, range).execute();
  return rows.map((row) => ({
    userId: row.userId,
    date: row.workDate,
    half: row.half,
    dayTypeCode: row.dayTypeCode,
    status: liveStatus(row.status),
  }));
}
