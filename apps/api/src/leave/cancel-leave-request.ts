import {
  canCancelLeaveRequest,
  canDeclareLeaveFor,
  MANAGER_CANCELLABLE_STATUSES,
  toWorkDate,
  truncateToMinute,
  type LeaveRequestView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { markLeaveNotificationsRead } from '../notifications/notification-repository';
import { notify } from '../notifications/notify';
import { findLeaveApproverIds } from './approvers';
import { LeaveNotCancellableError, LeaveNotFoundError } from './leave-errors';
import { findLeaveRequestById } from './leave-repository';
import { toLeaveRequestView } from './leave-view';
import { findVisibleLeaveRequest } from './read-leave-requests';

export async function cancelLeaveRequest(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; requestId: number },
): Promise<LeaveRequestView> {
  const { row, actor } = await findVisibleLeaveRequest(deps, command);
  const isOwner = row.userId === command.viewer.id;
  const isManagerCancel = !isOwner && canDeclareLeaveFor(actor, row.userId);
  // Visible but not cancellable by this viewer: the request might as well not exist.
  if (!isOwner && !isManagerCancel) throw new LeaveNotFoundError();
  const now = deps.now();
  const today = toWorkDate(now, deps.timeZone);
  const cancelledAt = truncateToMinute(now);
  await deps.db.transaction().execute(async (trx) => {
    // Re-read under a lock: a reviewer may have decided since the first read.
    const locked = await trx
      .selectFrom('leaveRequest')
      .select(['status', 'startDate'])
      .where('id', '=', row.id)
      .forNoKeyUpdate()
      .executeTakeFirstOrThrow();
    const isAllowed = isOwner
      ? canCancelLeaveRequest(locked, today)
      : MANAGER_CANCELLABLE_STATUSES.has(locked.status);
    if (!isAllowed) throw new LeaveNotCancellableError();
    await trx
      .updateTable('leaveRequest')
      .set({ status: 'cancelled', cancelledAt, cancelledById: command.viewer.id })
      .where('id', '=', row.id)
      .execute();
    await trx.deleteFrom('halfDay').where('leaveRequestId', '=', row.id).execute();
    await markLeaveNotificationsRead(trx, { leaveRequestId: row.id, readAt: cancelledAt });
    if (isManagerCancel) {
      const canceller = await trx
        .selectFrom('appUser')
        .select(['firstName', 'lastName'])
        .where('id', '=', command.viewer.id)
        .executeTakeFirstOrThrow();
      await notify(trx, {
        userId: row.userId,
        type: 'leave_request_withdrawn',
        payload: {
          leaveRequestId: row.id,
          actorName: `${canceller.firstName} ${canceller.lastName}`,
          dayTypeLabel: row.dayTypeLabel,
          startDate: row.startDate,
          endDate: row.endDate,
        },
      });
    } else if (locked.status === 'approved') {
      for (const approverId of await findLeaveApproverIds(trx, row.userId)) {
        await notify(trx, {
          userId: approverId,
          type: 'leave_request_cancelled',
          payload: {
            leaveRequestId: row.id,
            actorName: `${row.firstName} ${row.lastName}`,
            dayTypeLabel: row.dayTypeLabel,
            startDate: row.startDate,
            endDate: row.endDate,
          },
        });
      }
    }
  });
  const cancelled = await findLeaveRequestById(deps.db, row.id);
  if (!cancelled) throw new Error(`Leave request ${row.id} vanished`);
  return toLeaveRequestView(cancelled, { viewerId: command.viewer.id, actor, today });
}
