import type { DayBounds } from './time-zone';

const MILLISECONDS_PER_MINUTE = 60_000;

export interface ClockPeriodTimes {
  startedAt: Date;
  endedAt: Date | null;
}

export type ClockViolation =
  | 'CLOCK_END_BEFORE_START'
  | 'CLOCK_TIME_OUTSIDE_DAY'
  | 'CLOCK_TIME_IN_FUTURE'
  | 'CLOCK_ALREADY_RUNNING'
  | 'CLOCK_PERIOD_OVERLAP';

export function periodMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(
    0,
    Math.floor((endedAt.getTime() - startedAt.getTime()) / MILLISECONDS_PER_MINUTE),
  );
}

export function dayWorkedMinutes(
  periods: readonly ClockPeriodTimes[],
  { now, isToday }: { now: Date; isToday: boolean },
): number {
  return periods.reduce((totalMinutes, { startedAt, endedAt }) => {
    if (endedAt) return totalMinutes + periodMinutes(startedAt, endedAt);
    // A past day with an open period is "non débadgée": its open period counts nothing until
    // someone sets the real end time.
    return isToday ? totalMinutes + periodMinutes(startedAt, now) : totalMinutes;
  }, 0);
}

function isOpen(period: ClockPeriodTimes): boolean {
  return period.endedAt === null;
}

export function findDayPeriodViolation(
  periods: readonly ClockPeriodTimes[],
  bounds: DayBounds,
  now: Date,
): ClockViolation | null {
  if (
    periods.some(
      ({ startedAt, endedAt }) => endedAt !== null && endedAt.getTime() <= startedAt.getTime(),
    )
  ) {
    return 'CLOCK_END_BEFORE_START';
  }
  // The day runs 00:00-23:59: a period may not reach the next day's midnight.
  const isOutsideDay = ({ startedAt, endedAt }: ClockPeriodTimes) =>
    startedAt.getTime() < bounds.start.getTime() ||
    (endedAt ?? startedAt).getTime() >= bounds.nextStart.getTime();
  if (periods.some(isOutsideDay)) return 'CLOCK_TIME_OUTSIDE_DAY';
  const isInFuture = ({ startedAt, endedAt }: ClockPeriodTimes) =>
    startedAt.getTime() > now.getTime() || (endedAt !== null && endedAt.getTime() > now.getTime());
  if (periods.some(isInFuture)) return 'CLOCK_TIME_IN_FUTURE';
  if (periods.filter(isOpen).length > 1) return 'CLOCK_ALREADY_RUNNING';
  const byStart = [...periods].sort(
    (first, second) => first.startedAt.getTime() - second.startedAt.getTime(),
  );
  const overlapsNext = byStart.some((period, index) => {
    const next = byStart[index + 1];
    return (
      next !== undefined &&
      (period.endedAt === null || period.endedAt.getTime() > next.startedAt.getTime())
    );
  });
  return overlapsNext ? 'CLOCK_PERIOD_OVERLAP' : null;
}
