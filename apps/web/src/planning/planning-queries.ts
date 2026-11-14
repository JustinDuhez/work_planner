import { useQuery } from '@tanstack/react-query';
import { teamMonthSchema } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

export const TEAM_MONTH_QUERY_KEY = ['team-month'] as const;
export const ALL_TEAMS = 'toutes';

export function useTeamMonth(yearMonth: string) {
  return useQuery({
    queryKey: [...TEAM_MONTH_QUERY_KEY, yearMonth],
    queryFn: () => apiGet(`/api/v1/team-months/${yearMonth}`, teamMonthSchema),
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
