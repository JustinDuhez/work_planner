import type { ClockDayView, WorkMode } from '@work-planner/domain';
import { Building2, House, Play, Plus, Square } from 'lucide-react';
import { useState } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { isPlannedTelework } from '../leave/half-day-chips';
import { Button } from '../ui/button';
import { StatusMessage } from '../ui/status-message';
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
  const [chosenMode, setChosenMode] = useState<WorkMode | null>(null);
  const [isStopCancelled, setIsStopCancelled] = useState(false);
  const start = useStartClockPeriod(ownerId, isoWeek);
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const setDayMode = useSetDayMode(ownerId, isoWeek);
  const runningPeriod = day.periods.find((period) => period.endedAt === null);
  const workMode =
    day.workMode ?? chosenMode ?? (isPlannedTelework(day.halfDays) ? 'telework' : 'on_site');
  const errorMessage = bannerMessageFor(start.error ?? update.error ?? setDayMode.error, []);

  // Only the latest outcome is worth showing: a stale failure must not outlive a later success.
  function resetErrors() {
    setIsStopCancelled(false);
    start.reset();
    update.reset();
    setDayMode.reset();
  }

  function chooseMode(mode: WorkMode) {
    if (day.workMode === null) setChosenMode(mode);
    else {
      resetErrors();
      setDayMode.mutate({ date: day.date, workMode: mode });
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:items-end">
      {runningPeriod ? (
        <Button
          size="hero"
          isPending={update.isPending}
          onClick={() => {
            resetErrors();
            update.mutate(
              { periodId: runningPeriod.id, endedAt: 'now' },
              { onSuccess: (period) => setIsStopCancelled(period === null) },
            );
          }}
        >
          <Square size={18} aria-hidden /> {copy.clock.stop}
        </Button>
      ) : (
        <Button
          size="hero"
          isPending={start.isPending}
          onClick={() => {
            resetErrors();
            start.mutate(day.workMode === null ? { workMode } : {});
          }}
        >
          <Play size={18} aria-hidden /> {copy.clock.start}
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="inline-flex h-10 rounded-card border border-line bg-zinc-50 p-1">
          <legend className="sr-only">{copy.clock.workModeLabel}</legend>
          {WORK_MODE_OPTIONS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-1.5 rounded-inner-sm px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${workMode === value ? 'bg-white font-medium text-zinc-900 shadow-card' : 'text-zinc-600 hover:text-zinc-900'}`}
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
              <Icon size={16} aria-hidden /> {label}
            </label>
          ))}
        </fieldset>
        <Button variant="ghost" onClick={onAddPeriod}>
          <Plus size={16} aria-hidden /> {copy.clock.addPeriod}
        </Button>
      </div>
      <StatusMessage message={isStopCancelled ? copy.clock.periodCancelled : null} />
      {errorMessage ? (
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
