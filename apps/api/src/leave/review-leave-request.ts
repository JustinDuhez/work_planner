import {
  canReviewLeave,
  toWorkDate,
  truncateToMinute,
  type LeaveRequestView,
  type ReviewLeaveRequestRequest,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { markLeaveNotificationsRead } from '../notifications/notification-repository';
import { notify } from '../notifications/notify';
import {
  LeaveCommentRequiredError,
  LeaveNotPendingError,
  LeaveReviewForbiddenError,
} from './leave-errors';
import { findLeaveRequestById } from './leave-repository';
import { toLeaveRequestView } from './leave-view';
import { findVisibleLeaveRequest } from './read-leave-requests';

export async function reviewLeaveRequest(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; requestId: number } & ReviewLeaveRequestRequest,
): Promise<LeaveRequestView> {
  const { row, actor } = await findVisibleLeaveRequest(deps, command);
  if (!canReviewLeave(actor, row.userId)) throw new LeaveReviewForbiddenError();
  if (command.decision === 'refused' && !command.comment) throw new LeaveCommentRequiredError();
  const reviewedAt = truncateToMinute(deps.now());
  await deps.db.transaction().execute(async (trx) => {
    // The status guard makes the decision atomic: a second decider finds nothing pending.
    const decided = await trx
      .updateTable('leaveRequest')
      .set({
        status: command.decision,
        reviewerId: command.viewer.id,
        reviewComment: command.comment || null,
        reviewedAt,
      })
      .where('id', '=', row.id)
      .where('status', '=', 'pending')
      .returning('id')
      .executeTakeFirst();
    if (!decided) throw new LeaveNotPendingError();
    if (command.decision === 'refused') {
      await trx.deleteFrom('halfDay').where('leaveRequestId', '=', row.id).execute();
    }
    await markLeaveNotificationsRead(trx, { leaveRequestId: row.id, readAt: reviewedAt });
    const reviewer = await trx
      .selectFrom('appUser')
      .select(['firstName', 'lastName'])
      .where('id', '=', command.viewer.id)
      .executeTakeFirstOrThrow();
    await notify(trx, {
      userId: row.userId,
      type: 'leave_request_reviewed',
      payload: {
        leaveRequestId: row.id,
        actorName: `${reviewer.firstName} ${reviewer.lastName}`,
        dayTypeLabel: row.dayTypeLabel,
        startDate: row.startDate,
        endDate: row.endDate,
        decision: command.decision,
      },
    });
  });
  const reviewed = await findLeaveRequestById(deps.db, row.id);
  if (!reviewed) throw new Error(`Leave request ${row.id} vanished`);
  return toLeaveRequestView(reviewed, {
    viewerId: command.viewer.id,
    actor,
    today: toWorkDate(deps.now(), deps.timeZone),
  });
}
