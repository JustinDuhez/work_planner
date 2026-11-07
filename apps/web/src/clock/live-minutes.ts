import { dayWorkedMinutes, type ClockDayView } from '@work-planner/domain';

/** Today's total keeps ticking in the browser; other days use the server's total. */
export function liveDayMinutes(day: ClockDayView, now: Date): number {
  if (!day.isToday) return day.workedMinutes;
  const periods = day.periods.map((period) => ({
    startedAt: new Date(period.startedAt),
    endedAt: period.endedAt === null ? null : new Date(period.endedAt),
  }));
  return dayWorkedMinutes(periods, { now, isToday: true });
}
