import { useRef, useState, type FormEvent } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
import { TextField } from '../ui/text-field';
import { parseDuration } from './duration';
import { ErrorBanner, fieldErrorsOf } from './manage-user-dialog';
import { useCreateUser } from './user-mutations';

const DEFAULT_DURATION = '7:00';
const RENDERED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'dailyMinutes',
  'startDate',
  'initialPassword',
];

export function NewUserDialog({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [startDate, setStartDate] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [durationError, setDurationError] = useState<string>();
  const [failedChecks, setFailedChecks] = useState(0);
  const create = useCreateUser();
  const fieldErrors: Record<string, string | undefined> = {
    ...fieldErrorsOf(create.error),
    ...(durationError ? { dailyMinutes: durationError } : {}),
  };

  useFocusFirstInvalid(formRef, create.error);
  useFocusFirstInvalid(formRef, failedChecks);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.reset();
    const dailyMinutes = parseDuration(duration);
    if (dailyMinutes === null) {
      setDurationError(copy.manageUser.invalidDuration);
      setFailedChecks((count) => count + 1);
      return;
    }
    setDurationError(undefined);
    create.mutate(
      {
        firstName,
        lastName,
        email,
        isAdmin,
        dailyMinutes,
        initialPassword,
        ...(startDate === '' ? {} : { startDate }),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      title={copy.newUser.title}
      onClose={onClose}
      widthClass="w-[min(28rem,calc(100vw-2rem))]"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          label={copy.newUser.firstName}
          name="firstName"
          value={firstName}
          onChange={setFirstName}
          error={fieldErrors.firstName}
        />
        <TextField
          label={copy.newUser.lastName}
          name="lastName"
          value={lastName}
          onChange={setLastName}
          error={fieldErrors.lastName}
        />
        <TextField
          label={copy.newUser.email}
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(event) => setIsAdmin(event.target.checked)}
          />
          {copy.newUser.isAdmin}
        </label>
        <TextField
          label={copy.newUser.dailyTime}
          name="dailyMinutes"
          value={duration}
          onChange={(value) => {
            setDuration(value);
            setDurationError(undefined);
          }}
          error={fieldErrors.dailyMinutes}
        />
        <Field label={copy.newUser.startDate} error={fieldErrors.startDate}>
          {(control) => (
            <input
              {...control}
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        <TextField
          label={copy.newUser.initialPassword}
          name="initialPassword"
          type="password"
          autoComplete="new-password"
          value={initialPassword}
          onChange={setInitialPassword}
          error={fieldErrors.initialPassword}
          description={copy.newUser.initialPasswordHint}
        />
        <ErrorBanner message={bannerMessageFor(create.error, RENDERED_FIELDS)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.newUser.cancel}
          </Button>
          <Button type="submit" isPending={create.isPending}>
            {copy.newUser.create}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
