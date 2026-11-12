import {
  canEditPastClock,
  canResetCounter,
  counterDays,
  counterTotals,
  type DayHalfDays,
  hasOpenRefusal,
  type LatestCorrection,
  type WeekCounters,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { findPlannedHalfDays } from '../leave/leave-repository';
import { loadCounterFacts } from './counter-facts';
import { toCounterResetView, type CounterProfile } from './counter-repository';

export async function buildWeekCounters(
  deps: ClockDependencies,
  query: {
    owner: CounterProfile;
    week: { fromDate: string; toDate: string };
    instant: { now: Date; today: string };
    viewer: ClockViewer;
  },
): Promise<{
  counters: WeekCounters;
  targetMinutesByDate: Map<string, number>;
  holidayLabelByDate: Map<string, string>;
  latestCorrectionByDate: Map<string, LatestCorrection>;
  halfDaysByDate: Map<string, DayHalfDays>;
}> {
  const { now, today } = query.instant;
  const [facts, actor] = await Promise.all([
    loadCounterFacts(deps.db, { profile: query.owner, today }),
    query.viewer.loadActor(),
  ]);
  // One query covers both the counted history and the displayed week (future days show targets too).
  const holidayRange = {
    fromDate: facts.countingStart < query.week.fromDate ? facts.countingStart : query.week.fromDate,
    toDate: today > query.week.toDate ? today : query.week.toDate,
  };
  const holidays = await findPublicHolidays(deps.db, holidayRange);
  const plannedHalfDays = await findPlannedHalfDays(deps.db, {
    userId: query.owner.id,
    ...holidayRange,
  });
  const absentHalfDaysByDate = new Map<string, number>();
  const halfDaysByDate = new Map<string, DayHalfDays>();
  for (const halfDay of plannedHalfDays) {
    if (halfDay.status === 'approved' && !halfDay.isBadgeable) {
      absentHalfDaysByDate.set(
        halfDay.workDate,
        (absentHalfDaysByDate.get(halfDay.workDate) ?? 0) + 1,
      );
    }
    const day = halfDaysByDate.get(halfDay.workDate) ?? { am: null, pm: null };
    halfDaysByDate.set(halfDay.workDate, {
      ...day,
      [halfDay.half]: { dayTypeCode: halfDay.dayTypeCode, status: halfDay.status },
    });
  }
  const rules = {
    countingStart: facts.countingStart,
    today,
    now,
    currentDailyMinutes: query.owner.dailyMinutes,
    dailyMinutesChanges: facts.dailyMinutesChanges,
    publicHolidayDates: new Set(holidays.map((holiday) => holiday.date)),
    absentHalfDaysByDate,
  };
  const weekDays = counterDays(query.week, facts.periodsByDate, rules);
  const week = counterTotals(weekDays);
  const global = counterTotals(
    counterDays({ fromDate: facts.countingStart, toDate: today }, facts.periodsByDate, rules),
  );
  const runningPeriod = facts.periodsByDate.get(today)?.find((period) => period.endedAt === null);
  const canViewCorrections =
    query.viewer.id === query.owner.id || canEditPastClock(actor, query.owner.id);
  return {
    counters: {
      weekTargetMinutes: week.targetMinutes,
      weekBadgeableMinutes: week.badgeableMinutes,
      weekCountedWorkedMinutes: week.workedMinutes,
      weekGapMinutes: week.gapMinutes,
      globalGapMinutes: global.gapMinutes,
      startDate: query.owner.startDate,
      countingStartDate: facts.countingStart,
      runningSince: runningPeriod?.startedAt.toISOString() ?? null,
      canResetCounter: canResetCounter(actor, query.owner.id),
      hasOpenRefusal: hasOpenRefusal(facts.latestCorrections, facts.countingStart),
      canViewCorrections,
      lastReset: facts.lastReset ? toCounterResetView(facts.lastReset) : null,
    },
    targetMinutesByDate: new Map(weekDays.map((day) => [day.date, day.targetMinutes])),
    holidayLabelByDate: new Map(holidays.map((holiday) => [holiday.date, holiday.label])),
    halfDaysByDate,
    latestCorrectionByDate: canViewCorrections
      ? facts.latestCorrections
      : new Map<string, LatestCorrection>(),
  };
}
