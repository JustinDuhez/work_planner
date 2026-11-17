import { formatMinutes, formatSignedMinutes, type ClockWeek } from '@work-planner/domain';
import { useId, useState, type ReactNode } from 'react';
import { copy } from '../copy';
import { formatLongDate } from './clock-time';
import { liveGapMinutes, settledGapMinutes } from './live-counters';

// Red is reserved for an open refusal: it overrides the gap tone until the day is fixed.
const REFUSED_TONE = 'text-rose-700';
// A soft primary tint fading out, padded so it reads as a highlight behind the value.
const VALUE_FLASH = 'motion-safe:animate-[value-flash_600ms_ease-out]';
const STAT_VALUE = 'text-3xl -mx-1 rounded-inner-sm px-1 tracking-tight';

function gapToneClass(minutes: number): string {
  if (minutes > 0) return 'text-emerald-700';
  if (minutes < 0) return 'text-amber-700';
  return 'text-zinc-900';
}

export function Gap({
  minutes,
  className,
  isRefused = false,
}: {
  minutes: number;
  className: string;
  isRefused?: boolean;
}) {
  return (
    <span
      className={`font-semibold tabular-nums ${isRefused ? REFUSED_TONE : gapToneClass(minutes)} ${className}`}
    >
      {formatSignedMinutes(minutes)}
    </span>
  );
}

/** True from the first value that differs from the mounted one: nothing flashes on arrival. */
function useHasChanged(value: number): boolean {
  const [initialValue] = useState(value);
  const [hasChanged, setHasChanged] = useState(false);
  if (!hasChanged && value !== initialValue) setHasChanged(true);
  return hasChanged || value !== initialValue;
}

/**
 * Keyed on the settled value, not the live one: a real change (a stop, a reset, an edited period,
 * an approved correction) replays the highlight; the minute-by-minute tick and poll of a running
 * period do not.
 */
function FlashingGap({
  settledMinutes,
  liveMinutes,
  isRefused = false,
}: {
  settledMinutes: number;
  liveMinutes: number;
  isRefused?: boolean;
}) {
  const hasChanged = useHasChanged(settledMinutes);
  return (
    <Gap
      key={settledMinutes}
      minutes={liveMinutes}
      isRefused={isRefused}
      className={`${STAT_VALUE} ${hasChanged ? VALUE_FLASH : ''}`}
    />
  );
}

function Stat({
  title,
  value,
  children,
}: {
  title: string;
  value: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 id={titleId} className="text-xs font-medium text-zinc-500">
        {title}
      </h2>
      <p className="mt-1">{value}</p>
      <div className="mt-2 space-y-1 text-xs text-zinc-500">{children}</div>
    </section>
  );
}

export function CountersCard({
  week,
  now,
  actions,
  refusalAction,
}: {
  week: ClockWeek;
  now: Date;
  actions?: ReactNode;
  refusalAction?: ReactNode;
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
  // Ticks on any week: the running period is today's, and the global gap always includes today.
  const globalGapMinutes = liveGapMinutes(counters.globalGapMinutes, timing);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Stat
        title={copy.counters.weekTitle}
        value={
          <FlashingGap
            settledMinutes={
              isCurrentWeek
                ? settledGapMinutes(counters.weekGapMinutes, timing)
                : counters.weekGapMinutes
            }
            liveMinutes={weekGapMinutes}
          />
        }
      >
        <p className="flex flex-wrap gap-x-3 text-sm">
          <span>
            {copy.counters.worked}{' '}
            <span className="font-medium tabular-nums text-zinc-900">
              {formatMinutes(workedMinutes)}
            </span>
          </span>
          <span>
            {copy.counters.target}{' '}
            <span className="font-medium tabular-nums text-zinc-900">
              {formatMinutes(counters.weekTargetMinutes)}
            </span>
          </span>
        </p>
      </Stat>
      <Stat
        title={copy.counters.globalTitle}
        value={
          <FlashingGap
            settledMinutes={settledGapMinutes(counters.globalGapMinutes, timing)}
            liveMinutes={globalGapMinutes}
            isRefused={counters.hasOpenRefusal}
          />
        }
      >
        {counters.hasOpenRefusal && refusalAction ? <p>{refusalAction}</p> : null}
        <p>{`${copy.counters.since} ${formatLongDate(counters.countingStartDate)}`}</p>
        {counters.lastReset ? (
          <p>
            {`${copy.counters.lastResetPrefix} ${formatLongDate(counters.lastReset.resetDate)} ${copy.counters.lastResetBy} ${counters.lastReset.authorName}`}
          </p>
        ) : null}
        {actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
      </Stat>
    </div>
  );
}
