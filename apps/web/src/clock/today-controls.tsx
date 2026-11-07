import type { ClockDayView, WorkMode } from '@work-planner/domain';
import { Building2, House, Play, Plus, Square } from 'lucide-react';
import { useState } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useSetDayMode, useStartClockPeriod, useUpdateClockPeriod } from './clock-queries';

const WORK_MODE_OPTIONS: { value: WorkMode; label: string; Icon: typeof House }[] = [
  { value: 'on_site', label: copy.clock.onSite, Icon: Building2 },
  { value: 'telework', label: copy.clock.telework, Icon: House },
];

export function TodayControls({
  day,
  ownerId,
  isoWeek,
  onAddPeriod,
}: {
  day: ClockDayView;
  ownerId: number;
  isoWeek: string;
  onAddPeriod: () => void;
}) {
  const [chosenMode, setChosenMode] = useState<WorkMode>('on_site');
  const start = useStartClockPeriod(ownerId, isoWeek);
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const setDayMode = useSetDayMode(ownerId, isoWeek);
  const runningPeriod = day.periods.find((period) => period.endedAt === null);
  const workMode = day.workMode ?? chosenMode;
  const errorMessage = bannerMessageFor(start.error ?? update.error ?? setDayMode.error, []);

  function chooseMode(mode: WorkMode) {
    if (day.workMode === null) setChosenMode(mode);
    else setDayMode.mutate({ date: day.date, workMode: mode });
  }

  return (
    <div className="space-y-2">
      <fieldset className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
        <legend className="sr-only">{copy.clock.workModeLabel}</legend>
        {WORK_MODE_OPTIONS.map(({ value, label, Icon }) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs ${workMode === value ? 'bg-white font-medium text-zinc-900 shadow-card' : 'text-zinc-600'}`}
          >
            <input
              type="radio"
              name={`work-mode-${day.date}`}
              value={value}
              checked={workMode === value}
              onChange={() => chooseMode(value)}
              className="sr-only"
              aria-label={label}
            />
            <Icon size={14} aria-hidden /> {label}
          </label>
        ))}
      </fieldset>
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        {runningPeriod ? (
          <Button
            isPending={update.isPending}
            onClick={() => update.mutate({ periodId: runningPeriod.id, endedAt: 'now' })}
          >
            <Square size={16} aria-hidden /> {copy.clock.stop}
          </Button>
        ) : (
          <Button
            isPending={start.isPending}
            onClick={() => start.mutate(day.workMode === null ? { workMode } : {})}
          >
            <Play size={16} aria-hidden /> {copy.clock.start}
          </Button>
        )}
        <Button variant="secondary" onClick={onAddPeriod}>
          <Plus size={16} aria-hidden /> {copy.clock.addPeriod}
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
