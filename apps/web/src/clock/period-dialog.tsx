import { toLocalTime, type ClockPeriodView } from '@work-planner/domain';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { APP_TIME_ZONE } from './clock-time';
import { useDeleteClockPeriod, useStartClockPeriod, useUpdateClockPeriod } from './clock-queries';

const FIELD_NAMES = ['startedAt', 'endedAt'];

function localTimeOf(instant: string | null | undefined): string {
  return instant ? toLocalTime(new Date(instant), APP_TIME_ZONE) : '';
}

export function PeriodDialog({
  period,
  ownerId,
  isoWeek,
  onClose,
}: {
  period?: ClockPeriodView;
  ownerId: number;
  isoWeek: string;
  onClose: () => void;
}) {
  const endHintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [startedAt, setStartedAt] = useState(localTimeOf(period?.startedAt));
  const [endedAt, setEndedAt] = useState(localTimeOf(period?.endedAt));
  const create = useStartClockPeriod(ownerId, isoWeek);
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const remove = useDeleteClockPeriod(ownerId, isoWeek);
  const error = create.error ?? update.error ?? remove.error;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
  const bannerMessage = bannerMessageFor(error, FIELD_NAMES);
  const title = period ? copy.clock.editPeriodTitle : copy.clock.addPeriodTitle;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const times = { startedAt, ...(endedAt === '' ? {} : { endedAt }) };
    if (period) update.mutate({ periodId: period.id, ...times }, { onSuccess: onClose });
    else create.mutate(times, { onSuccess: onClose });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{title}</h2>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.clock.startTime}</span>
          <input
            type="time"
            required
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
            aria-invalid={fieldErrors.startedAt !== undefined}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3"
          />
          {fieldErrors.startedAt ? (
            <span className="text-xs text-rose-700">{fieldErrors.startedAt}</span>
          ) : null}
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.clock.endTime}</span>
          <input
            type="time"
            value={endedAt}
            onChange={(event) => setEndedAt(event.target.value)}
            aria-invalid={fieldErrors.endedAt !== undefined}
            aria-describedby={endHintId}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3"
          />
        </label>
        <p id={endHintId} className="-mt-3 text-xs text-zinc-500">
          {fieldErrors.endedAt ?? copy.clock.endTimeHint}
        </p>
        {bannerMessage ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {period ? (
            <Button
              variant="ghost"
              isPending={remove.isPending}
              onClick={() => remove.mutate(period.id, { onSuccess: onClose })}
            >
              {copy.clock.delete}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {copy.clock.cancel}
          </Button>
          <Button type="submit" isPending={create.isPending || update.isPending}>
            {copy.clock.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
