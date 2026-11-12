import {
  canCancelLeaveRequest,
  canReviewLeave,
  type Actor,
  type LeaveRequestView,
} from '@work-planner/domain';
import type { LeaveRequestRow } from './leave-repository';

export function toLeaveRequestView(
  row: LeaveRequestRow,
  context: { viewerId: number; actor: Actor; today: string },
): LeaveRequestView {
  return {
    id: row.id,
    user: { id: row.userId, firstName: row.firstName, lastName: row.lastName },
    dayTypeCode: row.dayTypeCode,
    startDate: row.startDate,
    startHalf: row.startHalf,
    endDate: row.endDate,
    endHalf: row.endHalf,
    halfDayCount: row.halfDayCount,
    status: row.status,
    reason: row.reason,
    ruleNote: row.ruleNote,
    isAutoApproved: row.isAutoApproved,
    reviewer:
      row.reviewerId === null || row.reviewerFirstName === null || row.reviewerLastName === null
        ? null
        : { id: row.reviewerId, firstName: row.reviewerFirstName, lastName: row.reviewerLastName },
    reviewComment: row.reviewComment,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    canReview: row.status === 'pending' && canReviewLeave(context.actor, row.userId),
    canCancel: row.userId === context.viewerId && canCancelLeaveRequest(row, context.today),
  };
}
