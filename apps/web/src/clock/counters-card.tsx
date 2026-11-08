import { formatMinutes, formatSignedMinutes, type ClockWeek } from '@work-planner/domain';
import type { ReactNode } from 'react';
import { copy } from '../copy';
import { formatLongDate } from './clock-time';
import { liveGapMinutes } from './live-counters';

function gapToneClass(minutes: number): string {
  if (minutes > 0) return 'text-emerald-700';
  if (minutes < 0) return 'text-amber-700';
  return 'text-zinc-900';
}

function Gap({ minutes, className }: { minutes: number; className: string }) {
  return (
    <span className={`font-semibold tabular-nums ${gapToneClass(minutes)} ${className}`}>
      {formatSignedMinutes(minutes)}
    </span>
  );
}

export function CountersCard({
  week,
  now,
  actions,
}: {
  week: ClockWeek;
  now: Date;
  actions?: ReactNode;
}) {
  const { counters } = week;
  const timing = { runningSince: counters.runningSince, serverNow: week.serverNow, now };
  // A running period belongs to today: it moves this week's gap only if today is in the week.
  const isCurrentWeek = week.days.some((day) => day.isToday);
  const weekGapMinutes = isCurrentWeek
    ? liveGapMinutes(counters.weekGapMinutes, timing)
    : counters.weekGapMinutes;
  // Same increment as the gaps: each minute worked since the answer adds one to the worked total.
  const workedMinutes = isCurrentWeek
    ? liveGapMinutes(counters.weekCountedWorkedMinutes, timing)
    : counters.weekCountedWorkedMinutes;
  const globalGapMinutes = liveGapMinutes(counters.globalGapMinutes, timing);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="rounded-card border border-zinc-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-medium text-zinc-500">{copy.counters.weekTitle}</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span>
            {copy.counters.worked}{' '}
            <span className="font-semibold tabular-nums text-zinc-900">
              {formatMinutes(workedMinutes)}
            </span>
          </span>
          <span>
            {copy.counters.target}{' '}
            <span className="font-semibold tabular-nums text-zinc-900">
              {formatMinutes(counters.weekTargetMinutes)}
            </span>
          </span>
        </p>
        <p className="mt-2 flex items-baseline justify-between text-sm">
          <span className="text-zinc-500">{copy.counters.weekGap}</span>
          <Gap minutes={weekGapMinutes} className="text-lg" />
        </p>
      </section>
      <section className="rounded-card border border-zinc-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-medium text-zinc-500">{copy.counters.globalTitle}</h2>
        <p className="mt-1">
          <Gap minutes={globalGapMinutes} className="text-2xl" />
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {`${copy.counters.since} ${formatLongDate(counters.countingStartDate)}`}
        </p>
        {counters.lastReset ? (
          <p className="text-xs text-zinc-500">
            {`${copy.counters.lastResetPrefix} ${formatLongDate(counters.lastReset.resetDate)} ${copy.counters.lastResetBy} ${counters.lastReset.authorName}`}
          </p>
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </section>
    </div>
  );
}
