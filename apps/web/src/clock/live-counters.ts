import { periodMinutes } from '@work-planner/domain';

/**
 * The server's gap is as of `serverNow`; while a period runs, every minute worked since then
 * reduces the deficit (or grows the surplus) by one minute.
 */
export function liveGapMinutes(
  gapMinutes: number,
  timing: { runningSince: string | null; serverNow: string; now: Date },
): number {
  if (timing.runningSince === null) return gapMinutes;
  const startedAt = new Date(timing.runningSince);
  const minutesSinceAnswer =
    periodMinutes(startedAt, timing.now) - periodMinutes(startedAt, new Date(timing.serverNow));
  return gapMinutes + Math.max(0, minutesSinceAnswer);
}
