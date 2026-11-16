import type { ClockDayView } from '@work-planner/domain';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
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
  const formRef = useRef<HTMLFormElement>(null);
  const [endedAt, setEndedAt] = useState('');
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const openPeriod = day.periods.find((period) => period.endedAt === null);
  const fieldError =
    update.error instanceof ApiError ? update.error.fieldErrors.endedAt : undefined;
  const bannerMessage = bannerMessageFor(update.error, ['endedAt']);
  useFocusFirstInvalid(formRef, update.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (openPeriod) update.mutate({ periodId: openPeriod.id, endedAt }, { onSuccess: onClose });
  }

  return (
    <Dialog title={copy.clock.closeDayTitle} onClose={onClose}>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-zinc-500">{copy.clock.closeDayHint}</p>
        <Field label={copy.clock.endTime} error={fieldError}>
          {(control) => (
            <input
              {...control}
              type="time"
              required
              value={endedAt}
              onChange={(event) => setEndedAt(event.target.value)}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        {bannerMessage ? (
          <p role="alert" className="rounded-control bg-rose-50 px-3 py-2 text-sm text-rose-800">
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
    </Dialog>
  );
}
