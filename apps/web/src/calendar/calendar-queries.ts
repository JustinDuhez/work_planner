import { useQuery } from '@tanstack/react-query';
import { yearCalendarSchema } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

export const YEAR_CALENDAR_QUERY_KEY = ['year-calendar'] as const;

export function useYearCalendar(userId: number, startYear: number) {
  return useQuery({
    queryKey: [...YEAR_CALENDAR_QUERY_KEY, userId, startYear],
    queryFn: () =>
      apiGet(`/api/v1/users/${userId}/year-calendars/${startYear}`, yearCalendarSchema),
  });
}

export function calendarPath(userId: number | undefined, startYear: number): string {
  return `${userId === undefined ? '/calendrier' : `/calendrier/${userId}`}?periode=${startYear}`;
}
