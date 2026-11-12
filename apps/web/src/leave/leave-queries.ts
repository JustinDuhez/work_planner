import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dayTypeListSchema,
  leaveRequestListSchema,
  leaveRequestSchema,
  leaveReviewInboxSchema,
  type CreateLeaveRequestRequest,
  type ReviewLeaveRequestRequest,
} from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from '../clock/clock-queries';
import { NOTIFICATIONS_QUERY_KEY } from '../notifications/notification-queries';

export const DAY_TYPES_QUERY_KEY = ['day-types'] as const;
export const LEAVE_REQUESTS_QUERY_KEY = ['leave-requests'] as const;

export function useDayTypes() {
  // Reference data: it changes with a migration, not during a session.
  return useQuery({
    queryKey: DAY_TYPES_QUERY_KEY,
    queryFn: () => apiGet('/api/v1/day-types', dayTypeListSchema),
    staleTime: Infinity,
  });
}

export function useInvalidateLeave() {
  const queryClient = useQueryClient();
  // A request changes the requests lists and the weeks (chips, counters).
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CLOCK_WEEK_QUERY_PREFIX }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    ]);
}

export function useCreateLeaveRequest() {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: (body: CreateLeaveRequestRequest) =>
      apiSend('POST', '/api/v1/leave-requests', body, leaveRequestSchema),
    onSuccess: invalidate,
  });
}

export function useOwnLeaveRequests() {
  return useQuery({
    queryKey: [...LEAVE_REQUESTS_QUERY_KEY, 'mine'],
    queryFn: () => apiGet('/api/v1/leave-requests?view=mine', leaveRequestListSchema),
  });
}

export function useLeaveInbox(isEnabled: boolean) {
  return useQuery({
    queryKey: [...LEAVE_REQUESTS_QUERY_KEY, 'to-review'],
    queryFn: () => apiGet('/api/v1/leave-requests?view=to-review', leaveReviewInboxSchema),
    enabled: isEnabled,
  });
}

export function useReviewLeaveRequest(requestId: number) {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: (body: ReviewLeaveRequestRequest) =>
      apiSend('PUT', `/api/v1/leave-requests/${requestId}/review`, body, leaveRequestSchema),
    onSuccess: invalidate,
  });
}

export function useCancelLeaveRequest(requestId: number) {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: () =>
      apiSend('PUT', `/api/v1/leave-requests/${requestId}/cancellation`, {}, leaveRequestSchema),
    onSuccess: invalidate,
  });
}
