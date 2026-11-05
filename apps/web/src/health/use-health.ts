import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

const HEALTH_REFRESH_INTERVAL_IN_MILLISECONDS = 60_000;

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/v1/health', healthResponseSchema),
    refetchInterval: HEALTH_REFRESH_INTERVAL_IN_MILLISECONDS,
  });
}
