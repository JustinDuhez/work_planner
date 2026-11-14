import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { counterResetListSchema, counterResetSchema } from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from './clock-queries';

export const COUNTER_RESETS_QUERY_PREFIX = ['counter-resets'] as const;

function counterResetsQueryKey(ownerId: number) {
  return [...COUNTER_RESETS_QUERY_PREFIX, ownerId] as const;
}

export function useCreateCounterReset(ownerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resetDate: string) =>
      apiSend('POST', `/api/v1/users/${ownerId}/counter-resets`, { resetDate }, counterResetSchema),
    // Every cached week of the person carries the global gap: refresh them all.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...CLOCK_WEEK_QUERY_PREFIX, ownerId] }),
        queryClient.invalidateQueries({ queryKey: counterResetsQueryKey(ownerId) }),
      ]),
  });
}

export function useCounterResets(ownerId: number) {
  return useQuery({
    queryKey: counterResetsQueryKey(ownerId),
    queryFn: () => apiGet(`/api/v1/users/${ownerId}/counter-resets`, counterResetListSchema),
  });
}
