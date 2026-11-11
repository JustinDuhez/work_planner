import { useQuery } from '@tanstack/react-query';
import { teamListSchema } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

export const TEAMS_QUERY_KEY = ['teams'] as const;

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: () => apiGet('/api/v1/teams', teamListSchema),
  });
}
