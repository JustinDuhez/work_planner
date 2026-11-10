import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [startDate, setStartDate] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [durationError, setDurationError] = useState<string>();
  const create = useCreateUser();
  const fieldErrors: Record<string, string | undefined> = {
    ...fieldErrorsOf(create.error),
    ...(durationError ? { dailyMinutes: durationError } : {}),
  };

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.reset();
    const dailyMinutes = parseDuration(duration);
    if (dailyMinutes === null) {
      setDurationError(copy.manageUser.invalidDuration);
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
    <dialog
      ref={dialogRef}
      aria-label={copy.newUser.title}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{copy.newUser.title}</h2>
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
          onChange={setDuration}
          error={fieldErrors.dailyMinutes}
        />
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.newUser.startDate}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3"
          />
          {fieldErrors.startDate ? (
            <span className="text-xs text-rose-700">{fieldErrors.startDate}</span>
          ) : null}
        </label>
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
    </dialog>
  );
}
