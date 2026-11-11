import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clockCorrectionListSchema,
  clockCorrectionSchema,
  type AnswerClockCorrectionRequest,
  type ClockCorrectionStatus,
  type CreateClockCorrectionRequest,
} from '@work-planner/domain';
import { apiGet, apiSend } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from '../clock/clock-queries';
import { NOTIFICATIONS_QUERY_KEY } from '../notifications/notification-queries';

function correctionsQueryKey(ownerId: number) {
  return ['clock-corrections', ownerId] as const;
}

function useInvalidateCorrections(ownerId: number) {
  const queryClient = useQueryClient();
  // The week shows the corrected day, the chips and the red flag; the bell shows the answers.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [...CLOCK_WEEK_QUERY_PREFIX, ownerId] }),
      queryClient.invalidateQueries({ queryKey: correctionsQueryKey(ownerId) }),
      queryClient.invalidateQueries({ queryKey: ['clock-correction'] }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    ]);
}

export function useCreateClockCorrection(ownerId: number) {
  const invalidate = useInvalidateCorrections(ownerId);
  return useMutation({
    mutationFn: (body: CreateClockCorrectionRequest) =>
      apiSend('POST', '/api/v1/clock-corrections', body, clockCorrectionSchema),
    onSuccess: invalidate,
  });
}

export function useClockCorrection(correctionId: number | null) {
  return useQuery({
    queryKey: ['clock-correction', correctionId],
    queryFn: () => apiGet(`/api/v1/clock-corrections/${correctionId}`, clockCorrectionSchema),
    enabled: correctionId !== null,
  });
}

export function useAnswerClockCorrection(ownerId: number) {
  const invalidate = useInvalidateCorrections(ownerId);
  return useMutation({
    mutationFn: ({
      correctionId,
      ...body
    }: { correctionId: number } & AnswerClockCorrectionRequest) =>
      apiSend('PATCH', `/api/v1/clock-corrections/${correctionId}`, body, clockCorrectionSchema),
    onSuccess: invalidate,
  });
}

export function useClockCorrections(
  ownerId: number,
  status: ClockCorrectionStatus,
  isEnabled: boolean,
) {
  return useQuery({
    queryKey: [...correctionsQueryKey(ownerId), status],
    queryFn: () =>
      apiGet(
        `/api/v1/users/${ownerId}/clock-corrections?statut=${status}`,
        clockCorrectionListSchema,
      ),
    enabled: isEnabled,
  });
}
