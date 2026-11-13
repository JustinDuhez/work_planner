import {
  addDays,
  expandWorkableHalfDays,
  isRangeOrdered,
  mondayOf,
  slotKey,
  toWorkDate,
  type CreateLeaveRequestRequest,
  type HalfDaySlot,
  type LeaveStatus,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { ClockDependencies } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { assertRealDate } from '../http/real-date';
import {
  LeaveDateInPastError,
  LeaveEmptyRangeError,
  LeaveOverlapError,
  LeaveRangeOrderError,
  LeaveRangeTooLongError,
  LeaveReasonRequiredError,
  LeaveSingleHalfDayError,
  LeaveTypeNotRequestableError,
} from './leave-errors';
import { findTakenSlots } from './leave-repository';

const MAX_RANGE_DAYS = 366;
const SUNDAY_OFFSET_DAYS = 6;
const EARLY_DEPARTURE = 'early_departure';

export interface PreparedLeaveRequest {
  request: CreateLeaveRequestRequest;
  dayType: { id: number; code: string; label: string };
  slots: HalfDaySlot[];
  firstSlot: HalfDaySlot;
  weeks: { fromDate: string; toDate: string };
  holidayDates: Set<string>;
  today: string;
}

/** Every creation rule shared by a person's request and a manager's declaration (E6a §3, E6b-D4). */
export async function prepareLeaveRequest(
  deps: ClockDependencies,
  request: CreateLeaveRequestRequest,
  options: { isDateFloorApplied: boolean },
): Promise<PreparedLeaveRequest> {
  const dayType = await deps.db
    .selectFrom('dayType')
    .select(['id', 'code', 'label', 'isRequestable'])
    .where('code', '=', request.dayTypeCode)
    .executeTakeFirst();
  if (!dayType?.isRequestable) throw new LeaveTypeNotRequestableError();
  assertRealDate(request.startDate, 'startDate');
  assertRealDate(request.endDate, 'endDate');
  const today = toWorkDate(deps.now(), deps.timeZone);
  if (options.isDateFloorApplied && request.startDate < today) throw new LeaveDateInPastError();
  if (!isRangeOrdered(request)) throw new LeaveRangeOrderError();
  if (request.endDate > addDays(request.startDate, MAX_RANGE_DAYS))
    throw new LeaveRangeTooLongError();
  // The telework rule looks at whole ISO weeks, so load their holidays too.
  const weeks = {
    fromDate: mondayOf(request.startDate),
    toDate: addDays(mondayOf(request.endDate), SUNDAY_OFFSET_DAYS),
  };
  const holidayDates = new Set(
    (await findPublicHolidays(deps.db, weeks)).map((holiday) => holiday.date),
  );
  const slots = expandWorkableHalfDays(request, holidayDates);
  const [firstSlot] = slots;
  if (firstSlot === undefined) throw new LeaveEmptyRangeError();
  const isEarlyDeparture = dayType.code === EARLY_DEPARTURE;
  if (isEarlyDeparture && !request.reason) throw new LeaveReasonRequiredError();
  if (isEarlyDeparture && slots.length !== 1) throw new LeaveSingleHalfDayError();
  return { request, dayType, slots, firstSlot, weeks, holidayDates, today };
}

/** One person's requests serialize: the overlap check and the telework rule see each other. */
export async function lockAndCheckOverlap(
  trx: Kysely<Database>,
  input: { userId: number; prepared: PreparedLeaveRequest },
): Promise<HalfDaySlot[]> {
  const { userId, prepared } = input;
  await trx
    .selectFrom('appUser')
    .select('id')
    .where('id', '=', userId)
    // NO KEY UPDATE serializes this person without blocking other tables' FK key-share checks.
    .forNoKeyUpdate()
    .executeTakeFirstOrThrow();
  const taken = await findTakenSlots(trx, { userId, ...prepared.weeks });
  const takenKeys = new Set(taken.map(slotKey));
  const clash = prepared.slots.find((slot) => takenKeys.has(slotKey(slot)));
  if (clash) throw new LeaveOverlapError(clash);
  return taken;
}

export async function insertLeaveRows(
  trx: Kysely<Database>,
  input: {
    userId: number;
    authorId: number;
    prepared: PreparedLeaveRequest;
    status: LeaveStatus;
    ruleNote: string | null;
    isAutoApproved: boolean;
    reviewerId: number | null;
    reviewedAt: Date | null;
  },
): Promise<number> {
  const { userId, prepared } = input;
  const { request, dayType, slots } = prepared;
  const { id } = await trx
    .insertInto('leaveRequest')
    .values({
      userId,
      authorId: input.authorId,
      dayTypeId: dayType.id,
      startDate: request.startDate,
      startHalf: request.startHalf,
      endDate: request.endDate,
      endHalf: request.endHalf,
      halfDayCount: slots.length,
      status: input.status,
      reason: request.reason || null,
      ruleNote: input.ruleNote,
      isAutoApproved: input.isAutoApproved,
      reviewerId: input.reviewerId,
      reviewedAt: input.reviewedAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await trx
    .insertInto('halfDay')
    .values(
      slots.map((slot) => ({
        userId,
        workDate: slot.date,
        half: slot.half,
        dayTypeId: dayType.id,
        leaveRequestId: id,
      })),
    )
    .execute();
  return id;
}
