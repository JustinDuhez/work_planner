import { useQuery } from '@tanstack/react-query';
import { clockWeekSchema, userSummaryListSchema, type ClockWeek } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

const RUNNING_WEEK_REFRESH_INTERVAL_IN_MILLISECONDS = 60_000;

export function clockWeekQueryKey(userId: number, isoWeek: string) {
  return ['clock-week', userId, isoWeek] as const;
}

function hasRunningPeriod(week: ClockWeek | undefined): boolean {
  return (
    week?.days.some(
      (day) => day.isToday && day.periods.some((period) => period.endedAt === null),
    ) ?? false
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
