import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { counterResetListSchema, counterResetSchema } from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';

function counterResetsQueryKey(ownerId: number) {
  return ['counter-resets', ownerId] as const;
}

export function useCreateCounterReset(ownerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resetDate: string) =>
      apiSend('POST', `/api/v1/users/${ownerId}/counter-resets`, { resetDate }, counterResetSchema),
    // Every cached week of the person carries the global gap: refresh them all.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clock-week', ownerId] }),
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
