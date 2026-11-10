import { dailyMinutesOn, type DailyMinutesChange } from '../counters/counting';

export type DailyMinutesChangePlan =
  | { kind: 'insert'; previousDailyMinutes: number }
  | { kind: 'keepExisting' }
  | { kind: 'refused'; reason: 'DATE_IN_PAST' | 'CHANGE_ORDER' };

export interface WorkingTime {
  dailyMinutes: number;
  startDate: string;
  plannedChange: { effectiveDate: string; dailyMinutes: number } | null;
}

function latestEffectiveDate(changes: readonly DailyMinutesChange[]): string | null {
  let latest: string | null = null;
  for (const change of changes) {
    if (latest === null || change.effectiveDate > latest) latest = change.effectiveDate;
  }
  return latest;
}

/**
 * Where a new daily time goes in the history (E2a-D6): never in the past, never before a planned
 * change. A second change on the same date keeps the original "previous" value: the history stays
 * one row per date and past days never move.
 */
export function planDailyMinutesChange(input: {
  effectiveDate: string;
  today: string;
  currentDailyMinutes: number;
  changes: readonly DailyMinutesChange[];
}): DailyMinutesChangePlan {
  if (input.effectiveDate < input.today) return { kind: 'refused', reason: 'DATE_IN_PAST' };
  const latest = latestEffectiveDate(input.changes);
  if (latest !== null && input.effectiveDate < latest) {
    return { kind: 'refused', reason: 'CHANGE_ORDER' };
  }
  if (latest === input.effectiveDate) return { kind: 'keepExisting' };
  // No change is dated after the new one, so the value in force the day before is the current one.
  return { kind: 'insert', previousDailyMinutes: input.currentDailyMinutes };
}

export function workingTimeOf(input: {
  today: string;
  currentDailyMinutes: number;
  startDate: string;
  changes: readonly DailyMinutesChange[];
}): WorkingTime {
  let nextChangeDate: string | null = null;
  for (const change of input.changes) {
    const isUpcoming = change.effectiveDate > input.today;
    if (isUpcoming && (nextChangeDate === null || change.effectiveDate < nextChangeDate)) {
      nextChangeDate = change.effectiveDate;
    }
  }
  return {
    dailyMinutes: dailyMinutesOn(input.today, input.currentDailyMinutes, input.changes),
    startDate: input.startDate,
    plannedChange:
      nextChangeDate === null
        ? null
        : {
            effectiveDate: nextChangeDate,
            dailyMinutes: dailyMinutesOn(nextChangeDate, input.currentDailyMinutes, input.changes),
          },
  };
}
