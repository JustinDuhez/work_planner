import type { ClockDayView } from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useUpdateClockPeriod } from './clock-queries';

export function CloseDayDialog({
  day,
  ownerId,
  isoWeek,
  onClose,
}: {
  day: ClockDayView;
  ownerId: number;
  isoWeek: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [endedAt, setEndedAt] = useState('');
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const openPeriod = day.periods.find((period) => period.endedAt === null);
  const fieldError =
    update.error instanceof ApiError ? update.error.fieldErrors.endedAt : undefined;
  const bannerMessage = bannerMessageFor(update.error, ['endedAt']);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (openPeriod) update.mutate({ periodId: openPeriod.id, endedAt }, { onSuccess: onClose });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.clock.closeDayTitle}
      onClose={onClose}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{copy.clock.closeDayTitle}</h2>
        <p className="text-sm text-zinc-500">{copy.clock.closeDayHint}</p>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.clock.endTime}</span>
          <input
            type="time"
            required
            value={endedAt}
            onChange={(event) => setEndedAt(event.target.value)}
            aria-invalid={fieldError !== undefined}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3"
          />
          {fieldError ? <span className="text-xs text-rose-700">{fieldError}</span> : null}
        </label>
        {bannerMessage ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.clock.cancel}
          </Button>
          <Button type="submit" isPending={update.isPending}>
            {copy.clock.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
