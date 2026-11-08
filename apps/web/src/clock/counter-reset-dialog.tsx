import { toWorkDate, type ClockWeek } from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { APP_TIME_ZONE, formatLongDate } from './clock-time';
import { useCreateCounterReset } from './counter-queries';

export function CounterResetDialog({ week, onClose }: { week: ClockWeek; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const today = toWorkDate(new Date(week.serverNow), APP_TIME_ZONE);
  const [resetDate, setResetDate] = useState(today);
  const createReset = useCreateCounterReset(week.user.id);
  const fieldError =
    createReset.error instanceof ApiError ? createReset.error.fieldErrors.resetDate : undefined;
  const bannerMessage = bannerMessageFor(createReset.error, ['resetDate']);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createReset.mutate(resetDate, { onSuccess: onClose });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.counters.resetTitle}
      onClose={onClose}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{copy.counters.resetTitle}</h2>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.counters.resetDate}</span>
          <input
            type="date"
            value={resetDate}
            min={week.counters.startDate}
            max={today}
            onChange={(event) => setResetDate(event.target.value)}
            aria-invalid={fieldError !== undefined}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3"
          />
          {fieldError ? <span className="text-xs text-rose-700">{fieldError}</span> : null}
        </label>
        <p className="text-sm text-zinc-600">
          {`${copy.counters.resetSentencePrefix} ${week.user.firstName} ${week.user.lastName} ${copy.counters.resetSentenceMiddle} ${resetDate === '' ? '…' : formatLongDate(resetDate)}.`}
        </p>
        {bannerMessage ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.counters.cancel}
          </Button>
          <Button type="submit" isPending={createReset.isPending}>
            {copy.counters.resetConfirm}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
