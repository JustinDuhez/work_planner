import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  publicHolidayImportResultSchema,
  publicHolidayListSchema,
  publicHolidaySchema,
  settingsSchema,
  type CreatePublicHolidayRequest,
} from '@work-planner/domain';
import { apiGet, apiSend, apiSendNoContent } from '../api/api-client';
import { CLOCK_WEEK_QUERY_PREFIX } from '../clock/clock-queries';

export const PUBLIC_HOLIDAYS_QUERY_KEY = ['public-holidays'] as const;
export const SETTINGS_QUERY_KEY = ['settings'] as const;

function useInvalidateHolidays() {
  const queryClient = useQueryClient();
  // Holidays change every week's targets and counters (E2b-D3).
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: PUBLIC_HOLIDAYS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CLOCK_WEEK_QUERY_PREFIX }),
    ]);
}

export function usePublicHolidays(year: number) {
  return useQuery({
    queryKey: [...PUBLIC_HOLIDAYS_QUERY_KEY, year],
    queryFn: () => apiGet(`/api/v1/public-holidays?year=${year}`, publicHolidayListSchema),
  });
}

export function useAddPublicHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (body: CreatePublicHolidayRequest) =>
      apiSend('POST', '/api/v1/public-holidays', body, publicHolidaySchema),
    onSuccess: invalidate,
  });
}

export function useRemovePublicHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (date: string) => apiSendNoContent('DELETE', `/api/v1/public-holidays/${date}`),
    onSuccess: invalidate,
  });
}

export function useImportPublicHolidays() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (year: number) =>
      apiSend('POST', '/api/v1/public-holiday-imports', { year }, publicHolidayImportResultSchema),
    onSuccess: invalidate,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => apiGet('/api/v1/settings', settingsSchema),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (yearStart: string) =>
      apiSend('PATCH', '/api/v1/settings', { yearStart }, settingsSchema),
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
}
