import {
  toWorkDate,
  type Actor,
  type LeaveRequestView,
  type LeaveReviewInbox,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { LeaveNotFoundError, LeaveReviewForbiddenError } from './leave-errors';
import {
  findLeaveRequestById,
  selectLeaveRequests,
  type LeaveRequestRow,
} from './leave-repository';
import { toLeaveRequestView } from './leave-view';

const RECENT_DECISIONS_DAYS = 30;
const DAY_IN_MILLISECONDS = 86_400_000;

/** Owner, admins and the requester's managers (any level) may see a request. */
function canSee(actor: Actor, requesterId: number): boolean {
  return actor.id === requesterId || actor.isAdmin || actor.managedUserIds.has(requesterId);
}

export async function listOwnLeaveRequests(
  deps: ClockDependencies,
  viewer: ClockViewer,
): Promise<LeaveRequestView[]> {
  const [rows, actor] = await Promise.all([
    selectLeaveRequests(deps.db)
      .where('leaveRequest.userId', '=', viewer.id)
      .orderBy('leaveRequest.createdAt', 'desc')
      .orderBy('leaveRequest.id', 'desc')
      .execute(),
    viewer.loadActor(),
  ]);
  const today = toWorkDate(deps.now(), deps.timeZone);
  return rows.map((row) => toLeaveRequestView(row, { viewerId: viewer.id, actor, today }));
}

export async function listLeaveRequestsToReview(
  deps: ClockDependencies,
  viewer: ClockViewer,
): Promise<LeaveReviewInbox> {
  const actor = await viewer.loadActor();
  if (!actor.isAdmin && !actor.isManager) throw new LeaveReviewForbiddenError();
  const now = deps.now();
  const today = toWorkDate(now, deps.timeZone);
  const scopedIds = [...actor.managedUserIds];
  // Admins see every active person; managers their whole scope (direct reports decide, the rest only see).
  const scoped = () => {
    const query = selectLeaveRequests(deps.db).where('leaveRequest.userId', '<>', viewer.id);
    if (actor.isAdmin) return query.where('requester.archivedAt', 'is', null);
    return scopedIds.length > 0 ? query.where('leaveRequest.userId', 'in', scopedIds) : null;
  };
  const pendingQuery = scoped();
  const recentQuery = scoped();
  if (!pendingQuery || !recentQuery) return { pending: [], recent: [] };
  const [pending, recent] = await Promise.all([
    pendingQuery
      .where('leaveRequest.status', '=', 'pending')
      .orderBy('leaveRequest.startDate')
      .execute(),
    recentQuery
      .where('leaveRequest.status', 'in', ['approved', 'refused'])
      .where(
        'leaveRequest.reviewedAt',
        '>=',
        new Date(now.getTime() - RECENT_DECISIONS_DAYS * DAY_IN_MILLISECONDS),
      )
      .orderBy('leaveRequest.reviewedAt', 'desc')
      .execute(),
  ]);
  const context = { viewerId: viewer.id, actor, today };
  return {
    pending: pending.map((row) => toLeaveRequestView(row, context)),
    recent: recent.map((row) => toLeaveRequestView(row, context)),
  };
}

export async function findVisibleLeaveRequest(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; requestId: number },
): Promise<{ row: LeaveRequestRow; actor: Actor }> {
  const [row, actor] = await Promise.all([
    findLeaveRequestById(deps.db, query.requestId),
    query.viewer.loadActor(),
  ]);
  if (!row || !canSee(actor, row.userId)) throw new LeaveNotFoundError();
  return { row, actor };
}
