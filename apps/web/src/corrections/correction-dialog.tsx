import {
  formatMinutes,
  formatSignedMinutes,
  localTimeToInstant,
  periodMinutes,
  toLocalTime,
  type ClockDayView,
  type WorkMode,
} from '@work-planner/domain';
import { Building2, House, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useCreateClockCorrection } from './correction-queries';

interface PeriodRow {
  key: number;
  startedAt: string;
  endedAt: string;
}

const WORK_MODE_OPTIONS: { value: WorkMode; label: string; Icon: typeof House }[] = [
  { value: 'on_site', label: copy.clock.onSite, Icon: Building2 },
  { value: 'telework', label: copy.clock.telework, Icon: House },
];

function rowsOf(day: ClockDayView): PeriodRow[] {
  return day.periods.map((period, index) => ({
    key: index,
    startedAt: toLocalTime(new Date(period.startedAt), APP_TIME_ZONE),
    // An open period waits for its real end: the manager fills it in.
    endedAt: period.endedAt === null ? '' : toLocalTime(new Date(period.endedAt), APP_TIME_ZONE),
  }));
}

/** A preview only: the server recomputes the total from the saved periods. */
function previewMinutes(date: string, rows: readonly PeriodRow[]): number {
  return rows.reduce((total, row) => {
    const startedAt = localTimeToInstant(date, row.startedAt, APP_TIME_ZONE);
    const endedAt = localTimeToInstant(date, row.endedAt, APP_TIME_ZONE);
    return startedAt && endedAt ? total + periodMinutes(startedAt, endedAt) : total;
  }, 0);
}

export function CorrectionDialog({
  day,
  ownerId,
  onClose,
}: {
  day: ClockDayView;
  ownerId: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [workMode, setWorkMode] = useState<WorkMode>(day.workMode ?? 'on_site');
  const [rows, setRows] = useState<PeriodRow[]>(() => rowsOf(day));
  const [nextKey, setNextKey] = useState(day.periods.length);
  const [comment, setComment] = useState('');
  const createCorrection = useCreateClockCorrection(ownerId);
  const fieldErrors =
    createCorrection.error instanceof ApiError ? createCorrection.error.fieldErrors : {};
  const fieldNames = rows.flatMap((_row, index) => [
    `periods.${index}.startedAt`,
    `periods.${index}.endedAt`,
  ]);
  const bannerMessage = bannerMessageFor(createCorrection.error, fieldNames);
  const afterMinutes = previewMinutes(day.date, rows);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function updateRow(key: number, change: Partial<PeriodRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, startedAt: '', endedAt: '' }]);
    setNextKey((key) => key + 1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCorrection.mutate(
      {
        userId: ownerId,
        date: day.date,
        workMode,
        periods: rows.map(({ startedAt, endedAt }) => ({ startedAt, endedAt })),
        ...(comment.trim() === '' ? {} : { comment: comment.trim() }),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.corrections.dialogTitle}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{`${copy.corrections.dialogTitle} — ${formatLongDate(day.date)}`}</h2>
        <fieldset className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          <legend className="sr-only">{copy.corrections.workMode}</legend>
          {WORK_MODE_OPTIONS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${workMode === value ? 'bg-white font-medium text-zinc-900 shadow-card' : 'text-zinc-600'}`}
            >
              <input
                type="radio"
                name="correction-work-mode"
                value={value}
                checked={workMode === value}
                onChange={() => setWorkMode(value)}
                className="sr-only"
                aria-label={label}
              />
              <Icon size={14} aria-hidden /> {label}
            </label>
          ))}
        </fieldset>
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const startError = fieldErrors[`periods.${index}.startedAt`];
            const endError = fieldErrors[`periods.${index}.endedAt`];
            return (
              <li key={row.key} className="space-y-1">
                <div className="flex items-end gap-2">
                  <label className="flex-1 space-y-1 text-xs font-medium">
                    <span>{copy.corrections.startTime}</span>
                    <input
                      type="time"
                      value={row.startedAt}
                      onChange={(event) => updateRow(row.key, { startedAt: event.target.value })}
                      aria-invalid={startError !== undefined}
                      className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                    />
                  </label>
                  <label className="flex-1 space-y-1 text-xs font-medium">
                    <span>{copy.corrections.endTime}</span>
                    <input
                      type="time"
                      value={row.endedAt}
                      onChange={(event) => updateRow(row.key, { endedAt: event.target.value })}
                      aria-invalid={endError !== undefined}
                      className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={copy.corrections.removePeriod}
                    onClick={() =>
                      setRows((current) => current.filter((other) => other.key !== row.key))
                    }
                    className="h-10 rounded-lg px-2 text-zinc-500 hover:bg-zinc-100"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                {(startError ?? endError) ? (
                  <p className="text-xs text-rose-700">{startError ?? endError}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" onClick={addRow}>
          <Plus size={16} aria-hidden /> {copy.corrections.addPeriod}
        </Button>
        <p className="text-sm tabular-nums text-zinc-600">
          {`${copy.corrections.total} ${formatMinutes(afterMinutes)} · ${copy.corrections.before} ${formatMinutes(day.workedMinutes)} · ${formatSignedMinutes(afterMinutes - day.workedMinutes)}`}
        </p>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.corrections.comment}</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        {bannerMessage ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.corrections.cancel}
          </Button>
          <Button type="submit" isPending={createCorrection.isPending}>
            {copy.corrections.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
