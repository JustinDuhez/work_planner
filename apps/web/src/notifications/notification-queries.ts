import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationListSchema, notificationSchema } from '@work-planner/domain';
import { apiGet, apiSend, apiSendNoContent } from '../api/api-client';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;
const NOTIFICATIONS_REFRESH_INTERVAL_IN_MILLISECONDS = 30_000;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => apiGet('/api/v1/notifications', notificationListSchema),
    // Polling (E5-D6); a real-time channel (S1) would replace this without touching the bell.
    refetchInterval: NOTIFICATIONS_REFRESH_INTERVAL_IN_MILLISECONDS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) =>
      apiSend(
        'PATCH',
        `/api/v1/notifications/${notificationId}`,
        { isRead: true },
        notificationSchema,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSendNoContent('PATCH', '/api/v1/notifications', { isRead: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
}
