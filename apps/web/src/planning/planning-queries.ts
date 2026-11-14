import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  counterResetBatchSchema,
  teamMonthSchema,
  type CreateCounterResetsRequest,
} from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from '../clock/clock-queries';
import { COUNTER_RESETS_QUERY_PREFIX } from '../clock/counter-queries';

export const TEAM_MONTH_QUERY_KEY = ['team-month'] as const;
export const ALL_TEAMS = 'toutes';

export function useTeamMonth(yearMonth: string) {
  return useQuery({
    queryKey: [...TEAM_MONTH_QUERY_KEY, yearMonth],
    queryFn: () => apiGet(`/api/v1/team-months/${yearMonth}`, teamMonthSchema),
    // Keeps the table and filters on screen while the next month loads.
    placeholderData: keepPreviousData,
    // The read runs the E4 balance per person: skip refetches for 30 s (a reset invalidates at once).
    staleTime: 30_000,
  });
}

export function planningPath(filters: {
  yearMonth: string;
  team: number | 'all';
  isAbsentOnly: boolean;
}): string {
  const params = new URLSearchParams({
    mois: filters.yearMonth,
    equipe: filters.team === 'all' ? ALL_TEAMS : String(filters.team),
  });
  if (filters.isAbsentOnly) params.set('absents', '1');
  return `/planning?${params.toString()}`;
}

export function useCreateCounterResets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCounterResetsRequest) =>
      apiSend('POST', '/api/v1/counter-resets', request, counterResetBatchSchema),
    // Balances live in the month view, every cached week and each person's reset history.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TEAM_MONTH_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CLOCK_WEEK_QUERY_PREFIX }),
        queryClient.invalidateQueries({ queryKey: COUNTER_RESETS_QUERY_PREFIX }),
      ]),
  });
}
