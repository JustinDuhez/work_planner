import type { LeaveStatus } from '../contracts/leave';

/** E6a-D3: pending at any time; approved only before its first day; started leave is the manager's. */
export function canCancelLeaveRequest(
  request: { status: LeaveStatus; startDate: string },
  today: string,
): boolean {
  if (request.status === 'pending') return true;
  return request.status === 'approved' && request.startDate > today;
}

/** E6b-D4: a scope manager or admin may cancel any live request, whatever its dates. */
export const MANAGER_CANCELLABLE_STATUSES: ReadonlySet<LeaveStatus> = new Set([
  'pending',
  'approved',
]);
