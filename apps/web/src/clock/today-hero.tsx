import { formatMinutes, toLocalTime, type ClockDayView, type WorkMode } from '@work-planner/domain';
import { useId } from 'react';
import { copy } from '../copy';
import { APP_TIME_ZONE } from './clock-time';
import { liveDayMinutes } from './live-minutes';
import { TodayControls } from './today-controls';

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  on_site: copy.clock.onSite,
  telework: copy.clock.telework,
};

/** The page's main feature: today's live total, then the one action that changes it. */
export function TodayHero({
  day,
  now,
  ownerId,
  isoWeek,
  onAddPeriod,
}: {
  day: ClockDayView;
  now: Date;
  ownerId: number;
  isoWeek: string;
  onAddPeriod: () => void;
}) {
  const titleId = useId();
  const runningPeriod = day.periods.find((period) => period.endedAt === null);
  const runningLine = runningPeriod
    ? [
        `${copy.clock.since} ${toLocalTime(new Date(runningPeriod.startedAt), APP_TIME_ZONE)}`,
        ...(day.workMode ? [WORK_MODE_LABEL[day.workMode]] : []),
      ].join(' · ')
    : null;
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={titleId} className="text-sm font-medium text-zinc-500">
            {copy.clock.todayTitle}
          </h2>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-5xl">
            {formatMinutes(liveDayMinutes(day, now))}
            {day.targetMinutes > 0 ? (
              <span className="ml-2 text-lg font-medium tracking-normal text-zinc-500 sm:text-xl">
                {`/ ${formatMinutes(day.targetMinutes)}`}
              </span>
            ) : null}
          </p>
          {runningLine ? <p className="mt-2 text-sm text-zinc-500">{runningLine}</p> : null}
        </div>
        <TodayControls day={day} ownerId={ownerId} isoWeek={isoWeek} onAddPeriod={onAddPeriod} />
      </div>
    </section>
  );
}
