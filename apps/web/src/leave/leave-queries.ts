import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dayTypeListSchema,
  leaveRequestSchema,
  type CreateLeaveRequestRequest,
} from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from '../clock/clock-queries';

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
