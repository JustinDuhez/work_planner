import {
  datesOfIsoWeek,
  toWorkDate,
  type ClockDayView,
  type ClockWeek,
  type UserSummary,
  type WeekCounters,
} from '@work-planner/domain';
import { APP_TIME_ZONE, currentIsoWeek } from '../clock/clock-time';
import type { MockResponse } from './mock-fetch';
import { SIGNED_IN_SESSION } from './sessions';

export const LEA: UserSummary = { id: 7, firstName: 'Léa', lastName: 'Moreau' };
export const HUGO: UserSummary = { id: 9, firstName: 'Hugo', lastName: 'Laurent' };

export function weekFixture(
  options: {
    isoWeek?: string;
    user?: UserSummary;
    isOwnWeek?: boolean;
    days?: Partial<Record<string, Partial<ClockDayView>>>;
    counters?: Partial<WeekCounters>;
  } = {},
): ClockWeek {
  const isoWeek = options.isoWeek ?? currentIsoWeek(new Date());
  const today = toWorkDate(new Date(), APP_TIME_ZONE);
  const isOwnWeek = options.isOwnWeek ?? true;
  const days = (datesOfIsoWeek(isoWeek) ?? []).map((date): ClockDayView => ({
    date,
    workMode: null,
    periods: [],
    workedMinutes: 0,
    badgeableMinutes: 0,
    isToday: date === today,
    isFuture: date > today,
    isUnclosed: false,
    canEdit: isOwnWeek && date === today,
    canClose: false,
    canCorrect: false,
    latestCorrection: null,
    ...options.days?.[date],
  }));
  return {
    user: options.user ?? LEA,
    isoWeek,
    serverNow: new Date().toISOString(),
    days,
    weekWorkedMinutes: days.reduce((total, day) => total + day.workedMinutes, 0),
    counters: {
      weekTargetMinutes: 0,
      weekBadgeableMinutes: 0,
      weekCountedWorkedMinutes: 0,
      weekGapMinutes: 0,
      globalGapMinutes: 0,
      startDate: '2026-01-05',
      countingStartDate: '2026-01-05',
      runningSince: null,
      canResetCounter: false,
      hasOpenRefusal: false,
      canViewCorrections: true,
      lastReset: null,
      ...options.counters,
    },
  };
}

/** Everything the signed-in home screen (Léa's current week) asks the API for. */
export function signedInHomeRoutes(week: ClockWeek = weekFixture()): Record<string, MockResponse> {
  return {
    'GET /api/v1/me': { status: 200, body: SIGNED_IN_SESSION },
    'GET /api/v1/health': { status: 200, body: { status: 'ok', database: 'up' } },
    'GET /api/v1/users': { status: 200, body: [HUGO, LEA] },
    [`GET /api/v1/users/${LEA.id}/clock-weeks/${week.isoWeek}`]: { status: 200, body: week },
  };
}
