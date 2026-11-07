import { formatMinutes, type ClockDayView } from '@work-planner/domain';
import { Building2, House, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { copy } from '../copy';
import { dayLabel } from './clock-time';
import { DayTimeline } from './day-timeline';
import { liveDayMinutes } from './live-minutes';

const WEEKEND_DAY_INDEXES = new Set([5, 6]);

export function WorkModeIcon({ workMode }: { workMode: ClockDayView['workMode'] }) {
  if (workMode === 'telework') return <House size={14} aria-label={copy.clock.telework} />;
  if (workMode === 'on_site') return <Building2 size={14} aria-label={copy.clock.onSite} />;
  return null;
}

export function DayRow({
  day,
  index,
  now,
  actions,
  onSelectPeriod,
}: {
  day: ClockDayView;
  index: number;
  now: Date;
  actions?: ReactNode;
  onSelectPeriod?: (periodId: number) => void;
}) {
  const { weekday, dayOfMonth } = dayLabel(day.date);
  const isWeekend = WEEKEND_DAY_INDEXES.has(index);
  return (
    <li
      aria-label={`${weekday} ${dayOfMonth}`}
      aria-current={day.isToday ? 'date' : undefined}
      className={`rounded-card border p-3 transition-colors grid grid-cols-[1fr_auto] items-center gap-x-4 sm:grid-cols-[5rem_1fr_4rem] ${
        day.isToday ? 'border-primary-500 bg-white shadow-card' : 'border-zinc-200 bg-white'
      } ${!day.isToday && (day.isFuture || isWeekend) ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 sm:col-start-1 sm:row-start-1 sm:block">
        <p className="text-xs font-semibold tracking-wide text-zinc-500">
          {weekday} <span className="text-zinc-900">{dayOfMonth}</span>
        </p>
        <div className="sm:mt-1">
          <WorkModeIcon workMode={day.workMode} />
        </div>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums sm:col-start-3 sm:row-start-1">
        {formatMinutes(liveDayMinutes(day, now))}
      </p>
      <div className="col-span-2 mt-2 space-y-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mt-0">
        <DayTimeline day={day} now={now} onSelectPeriod={onSelectPeriod} />
        {day.isUnclosed ? (
          <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            <TriangleAlert size={12} aria-hidden /> {copy.clock.unclosed}
          </p>
        ) : null}
        {actions}
      </div>
    </li>
  );
}
