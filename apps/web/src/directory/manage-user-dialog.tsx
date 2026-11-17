import {
  formatMinutes,
  toWorkDate,
  type DirectoryEntry,
  type UpdateWorkingTimeRequest,
} from '@work-planner/domain';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { ErrorBanner } from '../ui/error-banner';
import { StatusMessage } from '../ui/status-message';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
import { TextField } from '../ui/text-field';
import { parseDuration } from './duration';
import { useResetPassword, useUpdateUser, useUpdateWorkingTime } from './user-mutations';

type WorkingTime = NonNullable<DirectoryEntry['workingTime']>;
type RiskyAction = 'block' | 'archive' | 'reset' | 'grantAdmin' | 'revokeAdmin';

export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {};
}

function SavedStatus({ isShown }: { isShown: boolean }) {
  return <StatusMessage message={isShown ? copy.manageUser.saved : null} tone="success" />;
}

function IdentitySection({ entry }: { entry: DirectoryEntry }) {
  const [firstName, setFirstName] = useState(entry.firstName);
  const [lastName, setLastName] = useState(entry.lastName);
  const [email, setEmail] = useState(entry.email);
  const formRef = useRef<HTMLFormElement>(null);
  const update = useUpdateUser(entry.id);
  const fieldErrors = fieldErrorsOf(update.error);
  useFocusFirstInvalid(formRef, update.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ firstName, lastName, email });
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{copy.manageUser.identityTitle}</h3>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3" noValidate>
        <TextField
          label={copy.manageUser.firstName}
          name="firstName"
          value={firstName}
          onChange={setFirstName}
          error={fieldErrors.firstName}
        />
        <TextField
          label={copy.manageUser.lastName}
          name="lastName"
          value={lastName}
          onChange={setLastName}
          error={fieldErrors.lastName}
        />
        <TextField
          label={copy.manageUser.email}
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <ErrorBanner message={bannerMessageFor(update.error, ['firstName', 'lastName', 'email'])} />
        <div className="flex items-center gap-3">
          <Button type="submit" isPending={update.isPending}>
            {copy.manageUser.saveIdentity}
          </Button>
          <SavedStatus isShown={update.isSuccess} />
        </div>
      </form>
    </section>
  );
}

function AccessSection({ entry }: { entry: DirectoryEntry }) {
  const sectionRef = useRef<HTMLElement>(null);
  const update = useUpdateUser(entry.id);
  const reset = useResetPassword(entry.id);
  useFocusFirstInvalid(sectionRef, reset.error);
  const [newPassword, setNewPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<RiskyAction | null>(null);
  const name = `${entry.firstName} ${entry.lastName}`;
  const confirmationText: Record<RiskyAction, string> = {
    block: `${copy.manageUser.confirmBlockPrefix} ${name} ${copy.manageUser.confirmSuffix}`,
    archive: `${copy.manageUser.confirmArchivePrefix} ${name} ${copy.manageUser.confirmSuffix}`,
    grantAdmin: `${copy.manageUser.confirmGrantAdminPrefix} ${name} ${copy.manageUser.confirmAdminSuffix}`,
    revokeAdmin: `${copy.manageUser.confirmRevokeAdminPrefix} ${name} ${copy.manageUser.confirmAdminSuffix}`,
    reset: `${copy.manageUser.confirmResetPrefix} ${name} ${copy.manageUser.confirmResetSuffix}`,
  };

  function confirmPendingAction() {
    if (pendingAction === 'block') update.mutate({ isBlocked: true });
    if (pendingAction === 'archive') update.mutate({ isArchived: true });
    if (pendingAction === 'grantAdmin') update.mutate({ isAdmin: true });
    if (pendingAction === 'revokeAdmin') update.mutate({ isAdmin: false });
    if (pendingAction === 'reset')
      reset.mutate(newPassword, { onSuccess: () => setNewPassword('') });
    setPendingAction(null);
  }

  return (
    <section ref={sectionRef} className="space-y-3">
      <h3 className="text-sm font-semibold">{copy.manageUser.accessTitle}</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={entry.isAdmin}
          onChange={(event) =>
            setPendingAction(event.target.checked ? 'grantAdmin' : 'revokeAdmin')
          }
        />
        {copy.manageUser.isAdmin}
      </label>
      <div className="flex flex-wrap gap-2">
        {entry.isBlocked ? (
          <Button variant="secondary" onClick={() => update.mutate({ isBlocked: false })}>
            {copy.manageUser.unblock}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setPendingAction('block')}>
            {copy.manageUser.block}
          </Button>
        )}
        {entry.isArchived ? (
          <Button variant="secondary" onClick={() => update.mutate({ isArchived: false })}>
            {copy.manageUser.restore}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setPendingAction('archive')}>
            {copy.manageUser.archive}
          </Button>
        )}
      </div>
      <TextField
        label={copy.manageUser.newPassword}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={fieldErrorsOf(reset.error).newPassword}
      />
      <Button variant="secondary" onClick={() => setPendingAction('reset')}>
        {copy.manageUser.resetPassword}
      </Button>
      {pendingAction ? (
        <div className="space-y-2 rounded-control bg-amber-50 p-3 text-sm text-amber-900">
          <p>{confirmationText[pendingAction]}</p>
          <div className="flex gap-2">
            <Button onClick={confirmPendingAction}>{copy.manageUser.confirm}</Button>
            <Button variant="secondary" onClick={() => setPendingAction(null)}>
              {copy.manageUser.cancel}
            </Button>
          </div>
        </div>
      ) : null}
      <ErrorBanner message={bannerMessageFor(update.error, [])} />
      <ErrorBanner message={bannerMessageFor(reset.error, ['newPassword'])} />
      <SavedStatus isShown={update.isSuccess || reset.isSuccess} />
    </section>
  );
}

function WorkingTimeSection({
  entry,
  workingTime,
}: {
  entry: DirectoryEntry;
  workingTime: WorkingTime;
}) {
  const [duration, setDuration] = useState(formatMinutes(workingTime.dailyMinutes));
  const [effectiveDate, setEffectiveDate] = useState('');
  const [startDate, setStartDate] = useState(workingTime.startDate);
  const [durationError, setDurationError] = useState<string>();
  const [failedChecks, setFailedChecks] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const update = useUpdateWorkingTime(entry.id);
  const fieldErrors: Record<string, string | undefined> = {
    ...fieldErrorsOf(update.error),
    ...(durationError ? { dailyMinutes: durationError } : {}),
  };
  useFocusFirstInvalid(formRef, update.error);
  useFocusFirstInvalid(formRef, failedChecks);
  // The start date is an admin field; canManage is the admin right (canManageUsers).
  const canEditStartDate = entry.canManage;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.reset();
    const dailyMinutes = parseDuration(duration);
    if (dailyMinutes === null) {
      setDurationError(copy.manageUser.invalidDuration);
      setFailedChecks((count) => count + 1);
      return;
    }
    setDurationError(undefined);
    const isDailyTimeChange = dailyMinutes !== workingTime.dailyMinutes || effectiveDate !== '';
    const body: UpdateWorkingTimeRequest = {
      ...(isDailyTimeChange
        ? { dailyMinutes, ...(effectiveDate === '' ? {} : { effectiveDate }) }
        : {}),
      ...(canEditStartDate && startDate !== workingTime.startDate ? { startDate } : {}),
    };
    if (Object.keys(body).length > 0) update.mutate(body);
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{copy.manageUser.workingTimeTitle}</h3>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3" noValidate>
        <TextField
          label={copy.manageUser.dailyTime}
          name="dailyMinutes"
          value={duration}
          onChange={(value) => {
            setDuration(value);
            setDurationError(undefined);
          }}
          error={fieldErrors.dailyMinutes}
        />
        <Field label={copy.manageUser.effectiveDate} error={fieldErrors.effectiveDate}>
          {(control) => (
            <input
              {...control}
              type="date"
              value={effectiveDate}
              min={toWorkDate(new Date(), APP_TIME_ZONE)}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        {canEditStartDate ? (
          <Field label={copy.manageUser.startDate} error={fieldErrors.startDate}>
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
        ) : null}
        <ErrorBanner
          message={bannerMessageFor(update.error, ['dailyMinutes', 'effectiveDate', 'startDate'])}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" isPending={update.isPending}>
            {copy.manageUser.saveWorkingTime}
          </Button>
          <SavedStatus isShown={update.isSuccess} />
        </div>
      </form>
    </section>
  );
}

export function ManageUserDialog({
  entry,
  onClose,
}: {
  entry: DirectoryEntry;
  onClose: () => void;
}) {
  const { data: session } = useSession();

  return (
    <Dialog
      title={`${entry.firstName} ${entry.lastName}`}
      onClose={onClose}
      widthClass="w-[min(32rem,calc(100vw-2rem))]"
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-zinc-500">{entry.email}</p>
          <Button variant="ghost" onClick={onClose}>
            {copy.manageUser.close}
          </Button>
        </div>
        {entry.canManage ? <IdentitySection entry={entry} /> : null}
        {/* The server refuses every access change on oneself, so the section is not offered. */}
        {entry.canManage && entry.id !== session?.user.id ? <AccessSection entry={entry} /> : null}
        {entry.canEditWorkingTime && entry.workingTime && !entry.isArchived ? (
          <WorkingTimeSection entry={entry} workingTime={entry.workingTime} />
        ) : null}
      </div>
    </Dialog>
  );
}
