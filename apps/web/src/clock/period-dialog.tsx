import { toLocalTime, type ClockPeriodView } from '@work-planner/domain';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { ErrorBanner } from '../ui/error-banner';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
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
  const formRef = useRef<HTMLFormElement>(null);
  const [startedAt, setStartedAt] = useState(localTimeOf(period?.startedAt));
  const [endedAt, setEndedAt] = useState(localTimeOf(period?.endedAt));
  const create = useStartClockPeriod(ownerId, isoWeek);
  const update = useUpdateClockPeriod(ownerId, isoWeek);
  const remove = useDeleteClockPeriod(ownerId, isoWeek);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [failedChecks, setFailedChecks] = useState(0);
  const error = create.error ?? update.error ?? remove.error;
  const fieldErrors = {
    ...(error instanceof ApiError ? error.fieldErrors : {}),
    ...localErrors,
  };
  const bannerMessage = bannerMessageFor(error, FIELD_NAMES);
  // A closed period cannot be reopened by emptying its end: the server would keep the old one.
  const hasEnd = Boolean(period?.endedAt);
  const title = period ? copy.clock.editPeriodTitle : copy.clock.addPeriodTitle;

  useFocusFirstInvalid(formRef, error);
  useFocusFirstInvalid(formRef, failedChecks);

  function clearLocalError(field: string) {
    setLocalErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([name]) => name !== field)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The browser's own bubbles follow its locale, so the form skips them (noValidate).
    const missing = {
      ...(startedAt === '' ? { startedAt: copy.clock.startRequired } : {}),
      ...(hasEnd && endedAt === '' ? { endedAt: copy.clock.endRequired } : {}),
    };
    setLocalErrors(missing);
    if (Object.keys(missing).length > 0) {
      setFailedChecks((count) => count + 1);
      return;
    }
    const times = { startedAt, ...(endedAt === '' ? {} : { endedAt }) };
    if (period) update.mutate({ periodId: period.id, ...times }, { onSuccess: onClose });
    else create.mutate(times, { onSuccess: onClose });
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field label={copy.clock.startTime} error={fieldErrors.startedAt}>
          {(control) => (
            <input
              {...control}
              type="time"
              required
              value={startedAt}
              onChange={(event) => {
                setStartedAt(event.target.value);
                clearLocalError('startedAt');
              }}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        <Field
          label={copy.clock.endTime}
          error={fieldErrors.endedAt}
          hint={hasEnd ? undefined : copy.clock.endTimeHint}
        >
          {(control) => (
            <input
              {...control}
              type="time"
              required={hasEnd}
              value={endedAt}
              onChange={(event) => {
                setEndedAt(event.target.value);
                clearLocalError('endedAt');
              }}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        <ErrorBanner message={bannerMessage} />
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
    </Dialog>
  );
}
