import {
  canCancelLeaveRequest,
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
  // Only the owner cancels (E6a-D3); for anyone else the request might as well not exist.
  if (row.userId !== command.viewer.id) throw new LeaveNotFoundError();
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
    if (!canCancelLeaveRequest(locked, today)) throw new LeaveNotCancellableError();
    await trx
      .updateTable('leaveRequest')
      .set({ status: 'cancelled', cancelledAt })
      .where('id', '=', row.id)
      .execute();
    await trx.deleteFrom('halfDay').where('leaveRequestId', '=', row.id).execute();
    await markLeaveNotificationsRead(trx, { leaveRequestId: row.id, readAt: cancelledAt });
    if (locked.status === 'approved') {
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
