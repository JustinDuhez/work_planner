import { dayBounds, toLocalTime, type ClockDayView } from '@work-planner/domain';
import { APP_TIME_ZONE } from './clock-time';

const PERCENT = 100;

interface PeriodSegment {
  id: number;
  startedAt: Date;
  endedAt: Date | null;
  shownEndAt: Date;
}

function segmentsOf(day: ClockDayView, now: Date, nextStart: Date): PeriodSegment[] {
  return day.periods.map((period) => {
    const startedAt = new Date(period.startedAt);
    const endedAt = period.endedAt === null ? null : new Date(period.endedAt);
    // A running period grows until now; an unclosed one is drawn to the end of its day.
    const shownEndAt = endedAt ?? (day.isToday ? now : nextStart);
    return { id: period.id, startedAt, endedAt, shownEndAt };
  });
}

export function DayTimeline({
  day,
  now,
  onSelectPeriod,
}: {
  day: ClockDayView;
  now: Date;
  onSelectPeriod?: (periodId: number) => void;
}) {
  const { start, nextStart } = dayBounds(day.date, APP_TIME_ZONE);
  const dayLengthInMilliseconds = nextStart.getTime() - start.getTime();
  const percentOf = (instant: Date) =>
    ((instant.getTime() - start.getTime()) / dayLengthInMilliseconds) * PERCENT;

  const segments = segmentsOf(day, now, nextStart);
  const labelOf = (segment: PeriodSegment) =>
    `${toLocalTime(segment.startedAt, APP_TIME_ZONE)} – ${
      segment.endedAt ? toLocalTime(segment.endedAt, APP_TIME_ZONE) : '…'
    }`;

  return (
    <div className="space-y-1">
      {segments.length > 0 ? (
        <p className="text-[10px] tabular-nums text-zinc-500">
          {segments.map(labelOf).join(' · ')}
        </p>
      ) : null}
      <div className="relative h-10 rounded-lg bg-zinc-100/70">
        {segments.map((segment) => {
          const isOpen = segment.endedAt === null;
          const label = labelOf(segment);
          const className = `absolute inset-y-1 rounded-md text-[10px] font-medium transition-colors ${
            isOpen && !day.isToday
              ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800'
              : 'bg-primary-500/80 text-white hover:bg-primary-600'
          } ${isOpen && day.isToday ? 'animate-pulse' : ''}`;
          const style = {
            left: `${percentOf(segment.startedAt)}%`,
            width: `${Math.max(percentOf(segment.shownEndAt) - percentOf(segment.startedAt), 1)}%`,
          };
          return onSelectPeriod ? (
            <button
              key={segment.id}
              type="button"
              title={label}
              aria-label={label}
              className={className}
              style={style}
              onClick={() => onSelectPeriod(segment.id)}
            />
          ) : (
            <span
              role="img"
              key={segment.id}
              title={label}
              aria-label={label}
              className={className}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}
