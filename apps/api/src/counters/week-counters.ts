import {
  canResetCounter,
  counterDays,
  counterTotals,
  toWorkDate,
  type WeekCounters,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { loadCounterFacts } from './counter-facts';
import { toCounterResetView, type CounterProfile } from './counter-repository';

export async function buildWeekCounters(
  deps: ClockDependencies,
  query: { owner: CounterProfile; weekDates: readonly string[]; viewer: ClockViewer },
): Promise<{ counters: WeekCounters; targetMinutesByDate: Map<string, number> }> {
  const now = deps.now();
  const today = toWorkDate(now, deps.timeZone);
  const [facts, actor] = await Promise.all([
    loadCounterFacts(deps.db, { profile: query.owner, today }),
    query.viewer.loadActor(),
  ]);
  const rules = {
    countingStart: facts.countingStart,
    today,
    now,
    currentDailyMinutes: query.owner.dailyMinutes,
    dailyMinutesChanges: facts.dailyMinutesChanges,
  };
  const monday = query.weekDates[0] ?? today;
  const sunday = query.weekDates[query.weekDates.length - 1] ?? today;
  const weekDays = counterDays({ fromDate: monday, toDate: sunday }, facts.periodsByDate, rules);
  const week = counterTotals(weekDays);
  const global = counterTotals(
    counterDays({ fromDate: facts.countingStart, toDate: today }, facts.periodsByDate, rules),
  );
  const runningPeriod = facts.periodsByDate.get(today)?.find((period) => period.endedAt === null);
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
      lastReset: facts.lastReset ? toCounterResetView(facts.lastReset) : null,
    },
    targetMinutesByDate: new Map(weekDays.map((day) => [day.date, day.targetMinutes])),
  };
}
