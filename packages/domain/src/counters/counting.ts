import { addDays } from '../clock/time-zone';
import { dayWorkedMinutes, type ClockPeriodTimes } from '../clock/worked-minutes';

const FULL_DAY_HALF_DAYS = 2;
const SUNDAY_INDEX = 0;
const SATURDAY_INDEX = 6;

export interface DailyMinutesChange {
  effectiveDate: string;
  previousDailyMinutes: number;
}

export interface CountingRules {
  countingStart: string;
  today: string;
  now: Date;
  currentDailyMinutes: number;
  dailyMinutesChanges: readonly DailyMinutesChange[];
  /** Public holidays (E2b): no expected time, worked time still counts. */
  publicHolidayDates: ReadonlySet<string>;
  /** Approved non-badgeable half-days per date (E6a-D4). */
  absentHalfDaysByDate: ReadonlyMap<string, number>;
}

export interface CounterDay {
  date: string;
  workedMinutes: number;
  targetMinutes: number;
  badgeableMinutes: number;
}

export interface CounterTotals {
  workedMinutes: number;
  targetMinutes: number;
  badgeableMinutes: number;
  gapMinutes: number;
}

/** Days before the start date or before the reset that applies count nothing (E4-D1). */
export function countingStartDate(startDate: string, resetDate: string | null): string {
  return resetDate !== null && resetDate > startDate ? resetDate : startDate;
}

/**
 * A change row means "until the day before `effectiveDate`, the daily time was
 * `previousDailyMinutes`": the earliest change after the date holds the value of that date.
 */
export function dailyMinutesOn(
  date: string,
  currentDailyMinutes: number,
  changes: readonly DailyMinutesChange[],
): number {
  let nextChange: DailyMinutesChange | undefined;
  for (const change of changes) {
    const isAfterDate = change.effectiveDate > date;
    if (isAfterDate && (!nextChange || change.effectiveDate < nextChange.effectiveDate)) {
      nextChange = change;
    }
  }
  return nextChange?.previousDailyMinutes ?? currentDailyMinutes;
}

export function isWeekendDate(date: string): boolean {
  // Noon UTC: the calendar date never shifts, whatever the process time zone.
  const dayIndex = new Date(`${date}T12:00:00Z`).getUTCDay();
  return dayIndex === SATURDAY_INDEX || dayIndex === SUNDAY_INDEX;
}

export function badgeableMinutesOf(
  date: string,
  dailyMinutes: number,
  badgeableHalfDays: number,
): number {
  if (isWeekendDate(date)) return 0;
  // Half of an odd daily time rounds down: nobody owes a minute they cannot split.
  return Math.floor((dailyMinutes * badgeableHalfDays) / FULL_DAY_HALF_DAYS);
}

export function counterDays(
  range: { fromDate: string; toDate: string },
  periodsByDate: ReadonlyMap<string, readonly ClockPeriodTimes[]>,
  rules: CountingRules,
): CounterDay[] {
  const days: CounterDay[] = [];
  const firstDate = range.fromDate > rules.countingStart ? range.fromDate : rules.countingStart;
  for (let date = firstDate; date <= range.toDate; date = addDays(date, 1)) {
    const dailyMinutes = dailyMinutesOn(date, rules.currentDailyMinutes, rules.dailyMinutesChanges);
    // Public holidays (E2b-D3) have no expected time; each approved absent half-day (E6a-D4) removes half.
    const absentHalfDays = rules.absentHalfDaysByDate.get(date) ?? 0;
    const badgeableHalfDays = rules.publicHolidayDates.has(date)
      ? 0
      : Math.max(0, FULL_DAY_HALF_DAYS - absentHalfDays);
    const targetMinutes = badgeableMinutesOf(date, dailyMinutes, badgeableHalfDays);
    const isPast = date < rules.today;
    const isToday = date === rules.today;
    const periods = periodsByDate.get(date) ?? [];
    days.push({
      date,
      targetMinutes,
      // Today's badgeable time is owed only once the day has ended (E4-D2).
      badgeableMinutes: isPast ? targetMinutes : 0,
      workedMinutes: isPast || isToday ? dayWorkedMinutes(periods, { now: rules.now, isToday }) : 0,
    });
  }
  return days;
}

export function counterTotals(days: readonly CounterDay[]): CounterTotals {
  let workedMinutes = 0;
  let targetMinutes = 0;
  let badgeableMinutes = 0;
  for (const day of days) {
    workedMinutes += day.workedMinutes;
    targetMinutes += day.targetMinutes;
    badgeableMinutes += day.badgeableMinutes;
  }
  return {
    workedMinutes,
    targetMinutes,
    badgeableMinutes,
    gapMinutes: workedMinutes - badgeableMinutes,
  };
}
