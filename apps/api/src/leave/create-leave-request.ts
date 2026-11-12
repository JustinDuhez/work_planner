import {
  addDays,
  expandWorkableHalfDays,
  findTeleworkShortfalls,
  isRangeOrdered,
  mondayOf,
  slotKey,
  teleworkRuleNote,
  toWorkDate,
  type CreateLeaveRequestRequest,
  type LeaveRequestView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { isUniqueViolation } from '../db/postgres-errors';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { assertRealDate } from '../http/real-date';
import { notify } from '../notifications/notify';
import { findLeaveApproverIds } from './approvers';
import {
  LeaveOverlapError,
  LeaveDateInPastError,
  LeaveEmptyRangeError,
  LeaveRangeOrderError,
  LeaveRangeTooLongError,
  LeaveReasonRequiredError,
  LeaveSingleHalfDayError,
  LeaveTypeNotRequestableError,
} from './leave-errors';
import { findLeaveRequestById, findTakenSlots } from './leave-repository';
import { toLeaveRequestView } from './leave-view';

const MAX_RANGE_DAYS = 366;
const SUNDAY_OFFSET_DAYS = 6;
const EARLY_DEPARTURE = 'early_departure';
const TELEWORK = 'telework';

async function holidaySet(deps: ClockDependencies, range: { fromDate: string; toDate: string }) {
  return new Set((await findPublicHolidays(deps.db, range)).map((holiday) => holiday.date));
}

export async function createLeaveRequest(
  deps: ClockDependencies,
  command: { viewer: ClockViewer } & CreateLeaveRequestRequest,
): Promise<LeaveRequestView> {
  const { viewer, ...request } = command;
  const dayType = await deps.db
    .selectFrom('dayType')
    .select(['id', 'code', 'label', 'isRequestable'])
    .where('code', '=', request.dayTypeCode)
    .executeTakeFirst();
  if (!dayType?.isRequestable) throw new LeaveTypeNotRequestableError();
  assertRealDate(request.startDate, 'startDate');
  assertRealDate(request.endDate, 'endDate');
  const today = toWorkDate(deps.now(), deps.timeZone);
  if (request.startDate < today) throw new LeaveDateInPastError();
  if (!isRangeOrdered(request)) throw new LeaveRangeOrderError();
  if (request.endDate > addDays(request.startDate, MAX_RANGE_DAYS))
    throw new LeaveRangeTooLongError();
  // The telework rule looks at whole ISO weeks, so load their holidays too.
  const weeks = {
    fromDate: mondayOf(request.startDate),
    toDate: addDays(mondayOf(request.endDate), SUNDAY_OFFSET_DAYS),
  };
  const holidayDates = await holidaySet(deps, weeks);
  const slots = expandWorkableHalfDays(request, holidayDates);
  const [firstSlot] = slots;
  if (firstSlot === undefined) throw new LeaveEmptyRangeError();
  const isEarlyDeparture = dayType.code === EARLY_DEPARTURE;
  if (isEarlyDeparture && !request.reason) throw new LeaveReasonRequiredError();
  if (isEarlyDeparture && slots.length !== 1) throw new LeaveSingleHalfDayError();

  const approverIds = await findLeaveApproverIds(deps.db, viewer.id);
  let requestId: number;
  try {
    requestId = await deps.db.transaction().execute(async (trx) => {
      // One person's requests serialize: the overlap check and the telework rule see each other.
      await trx
        .selectFrom('appUser')
        .select('id')
        .where('id', '=', viewer.id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const taken = await findTakenSlots(trx, { userId: viewer.id, ...weeks });
      const takenKeys = new Set(taken.map(slotKey));
      const clash = slots.find((slot) => takenKeys.has(slotKey(slot)));
      if (clash) throw new LeaveOverlapError(clash);
      const ruleNote =
        dayType.code === TELEWORK
          ? teleworkRuleNote(
              findTeleworkShortfalls({ requested: slots, declared: taken, holidayDates }),
            )
          : null;
      const isAutoApproved =
        approverIds.length === 0 || (dayType.code === TELEWORK && ruleNote === null);
      const { id } = await trx
        .insertInto('leaveRequest')
        .values({
          userId: viewer.id,
          dayTypeId: dayType.id,
          startDate: request.startDate,
          startHalf: request.startHalf,
          endDate: request.endDate,
          endHalf: request.endHalf,
          halfDayCount: slots.length,
          status: isAutoApproved ? 'approved' : 'pending',
          reason: request.reason || null,
          ruleNote,
          isAutoApproved,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('halfDay')
        .values(
          slots.map((slot) => ({
            userId: viewer.id,
            workDate: slot.date,
            half: slot.half,
            dayTypeId: dayType.id,
            leaveRequestId: id,
          })),
        )
        .execute();
      if (!isAutoApproved) {
        const requester = await trx
          .selectFrom('appUser')
          .select(['firstName', 'lastName'])
          .where('id', '=', viewer.id)
          .executeTakeFirstOrThrow();
        for (const approverId of approverIds) {
          await notify(trx, {
            userId: approverId,
            type: 'leave_request_received',
            payload: {
              leaveRequestId: id,
              actorName: `${requester.firstName} ${requester.lastName}`,
              dayTypeLabel: dayType.label,
              startDate: request.startDate,
              endDate: request.endDate,
            },
          });
        }
      }
      return id;
    });
  } catch (error) {
    // The unique index is the last guard; with the row lock it only fires on a manual insert.
    if (isUniqueViolation(error)) throw new LeaveOverlapError(firstSlot);
    throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
  }
  const created = await findLeaveRequestById(deps.db, requestId);
  if (!created) throw new Error(`Leave request ${requestId} vanished`);
  return toLeaveRequestView(created, {
    viewerId: viewer.id,
    actor: await viewer.loadActor(),
    today,
  });
}
