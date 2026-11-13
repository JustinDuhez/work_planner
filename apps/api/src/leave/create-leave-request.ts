import {
  findTeleworkShortfalls,
  teleworkRuleNote,
  type CreateLeaveRequestRequest,
  type LeaveRequestView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { isUniqueViolation } from '../db/postgres-errors';
import { notify } from '../notifications/notify';
import { findLeaveApproverIds } from './approvers';
import { insertLeaveRows, lockAndCheckOverlap, prepareLeaveRequest } from './leave-creation';
import { LeaveOverlapError } from './leave-errors';
import { findLeaveRequestById } from './leave-repository';
import { toLeaveRequestView } from './leave-view';

const TELEWORK = 'telework';

export async function createLeaveRequest(
  deps: ClockDependencies,
  command: { viewer: ClockViewer } & CreateLeaveRequestRequest,
): Promise<LeaveRequestView> {
  const { viewer, ...request } = command;
  const prepared = await prepareLeaveRequest(deps, request, { isDateFloorApplied: true });
  const { dayType, slots, holidayDates } = prepared;
  const approverIds = await findLeaveApproverIds(deps.db, viewer.id);
  let requestId: number;
  try {
    requestId = await deps.db.transaction().execute(async (trx) => {
      const taken = await lockAndCheckOverlap(trx, { userId: viewer.id, prepared });
      const ruleNote =
        dayType.code === TELEWORK
          ? teleworkRuleNote(
              findTeleworkShortfalls({ requested: slots, declared: taken, holidayDates }),
            )
          : null;
      const isAutoApproved =
        approverIds.length === 0 || (dayType.code === TELEWORK && ruleNote === null);
      const id = await insertLeaveRows(trx, {
        userId: viewer.id,
        authorId: viewer.id,
        prepared,
        status: isAutoApproved ? 'approved' : 'pending',
        ruleNote,
        isAutoApproved,
        reviewerId: null,
        reviewedAt: null,
      });
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
    if (isUniqueViolation(error)) throw new LeaveOverlapError(prepared.firstSlot);
    throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
  }
  const created = await findLeaveRequestById(deps.db, requestId);
  if (!created) throw new Error(`Leave request ${requestId} vanished`);
  return toLeaveRequestView(created, {
    viewerId: viewer.id,
    actor: await viewer.loadActor(),
    today: prepared.today,
  });
}
