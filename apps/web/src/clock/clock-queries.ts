import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clockDayModeSchema,
  clockPeriodSchema,
  clockWeekSchema,
  userSummaryListSchema,
  type ClockWeek,
  type StartClockPeriodRequest,
  type UpdateClockPeriodRequest,
  type WorkMode,
} from '@work-planner/domain';
import { apiGet, apiSend, apiSendNoContent } from '../api/api-client';

const RUNNING_WEEK_REFRESH_INTERVAL_IN_MILLISECONDS = 60_000;

export function clockWeekQueryKey(userId: number, isoWeek: string) {
  return ['clock-week', userId, isoWeek] as const;
}

export function hasRunningPeriod(week: ClockWeek | undefined): boolean {
  if (!week) return false;
  // The global counter runs on any week while today's period is open.
  return (
    week.counters.runningSince !== null ||
    week.days.some((day) => day.isToday && day.periods.some((period) => period.endedAt === null))
  );
}

export function useClockWeek(userId: number, isoWeek: string) {
  return useQuery({
    queryKey: clockWeekQueryKey(userId, isoWeek),
    queryFn: () => apiGet(`/api/v1/users/${userId}/clock-weeks/${isoWeek}`, clockWeekSchema),
    // Keep the day totals honest while someone is clocked in (another device may stop them).
    refetchInterval: (query) =>
      hasRunningPeriod(query.state.data) ? RUNNING_WEEK_REFRESH_INTERVAL_IN_MILLISECONDS : false,
  });
}

export function useActiveUsers() {
  return useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => apiGet('/api/v1/users', userSummaryListSchema),
    staleTime: Infinity,
  });
}

function useInvalidatingMutation<TVariables, TResult>(
  ownerId: number,
  isoWeek: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clockWeekQueryKey(ownerId, isoWeek) }),
  });
}

export function useStartClockPeriod(ownerId: number, isoWeek: string) {
  return useInvalidatingMutation(ownerId, isoWeek, (body: StartClockPeriodRequest) =>
    apiSend('POST', '/api/v1/clock-periods', body, clockPeriodSchema),
  );
}

export function useUpdateClockPeriod(ownerId: number, isoWeek: string) {
  return useInvalidatingMutation(
    ownerId,
    isoWeek,
    ({ periodId, ...body }: { periodId: number } & UpdateClockPeriodRequest) =>
      apiSend('PATCH', `/api/v1/clock-periods/${periodId}`, body, clockPeriodSchema),
  );
}

export function useDeleteClockPeriod(ownerId: number, isoWeek: string) {
  return useInvalidatingMutation(ownerId, isoWeek, (periodId: number) =>
    apiSendNoContent('DELETE', `/api/v1/clock-periods/${periodId}`),
  );
}

export function useSetDayMode(ownerId: number, isoWeek: string) {
  return useInvalidatingMutation(
    ownerId,
    isoWeek,
    ({ date, workMode }: { date: string; workMode: WorkMode }) =>
      apiSend('PATCH', `/api/v1/clock-days/${date}`, { workMode }, clockDayModeSchema),
  );
}
