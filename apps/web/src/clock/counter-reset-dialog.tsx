import { toWorkDate, type ClockWeek } from '@work-planner/domain';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { ErrorBanner } from '../ui/error-banner';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
import { APP_TIME_ZONE, formatLongDate } from './clock-time';
import { useCreateCounterReset } from './counter-queries';

export function CounterResetDialog({ week, onClose }: { week: ClockWeek; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const today = toWorkDate(new Date(week.serverNow), APP_TIME_ZONE);
  const [resetDate, setResetDate] = useState(today);
  const createReset = useCreateCounterReset(week.user.id);
  const fieldError =
    createReset.error instanceof ApiError ? createReset.error.fieldErrors.resetDate : undefined;
  const bannerMessage = bannerMessageFor(createReset.error, ['resetDate']);
  useFocusFirstInvalid(formRef, createReset.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createReset.mutate(resetDate, { onSuccess: onClose });
  }

  return (
    <Dialog title={copy.counters.resetTitle} onClose={onClose}>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label={copy.counters.resetDate} error={fieldError}>
          {(control) => (
            <input
              {...control}
              type="date"
              value={resetDate}
              min={week.counters.startDate}
              max={today}
              onChange={(event) => setResetDate(event.target.value)}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        <p className="text-sm text-zinc-600">
          {`${copy.counters.resetSentencePrefix} ${week.user.firstName} ${week.user.lastName} ${copy.counters.resetSentenceMiddle} ${resetDate === '' ? '…' : formatLongDate(resetDate)}.`}
        </p>
        <ErrorBanner message={bannerMessage} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.counters.cancel}
          </Button>
          <Button type="submit" isPending={createReset.isPending}>
            {copy.counters.resetConfirm}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
