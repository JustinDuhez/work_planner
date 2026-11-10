import { useMutation } from '@tanstack/react-query';
import {
  estimatePasswordStrength,
  findPasswordPolicyViolation,
  PASSWORD_POLICY_MESSAGES,
  type PasswordStrength,
} from '@work-planner/domain';
import { useState, type FormEvent } from 'react';
import { ApiError, apiSendNoContent } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';

const STRENGTH_SEGMENT_COUNT_BY_LEVEL: Record<PasswordStrength, number> = {
  weak: 1,
  fair: 2,
  strong: 3,
};
const STRENGTH_SEGMENT_CLASS: Record<PasswordStrength, string> = {
  weak: 'bg-rose-400',
  fair: 'bg-amber-400',
  strong: 'bg-emerald-500',
};
const STRENGTH_SEGMENTS = [1, 2, 3];

export function PasswordForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const change = useMutation({
    mutationFn: () =>
      apiSendNoContent('PUT', '/api/v1/me/password', { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      onSuccess?.();
    },
  });
  const serverErrors = change.error instanceof ApiError ? change.error.fieldErrors : {};
  const fieldErrors = { ...serverErrors, ...clientErrors };
  const bannerMessage = bannerMessageFor(change.error, [
    'currentPassword',
    'newPassword',
    'confirmation',
  ]);
  const strength = newPassword === '' ? undefined : estimatePasswordStrength(newPassword);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    change.reset();
    const violation = findPasswordPolicyViolation(newPassword, currentPassword);
    const errors: Record<string, string> = {};
    if (violation) errors.newPassword = PASSWORD_POLICY_MESSAGES[violation];
    if (confirmation !== newPassword) errors.confirmation = copy.password.mismatch;
    setClientErrors(errors);
    if (Object.keys(errors).length === 0) {
      change.mutate();
    }
  }

  return (
    <section
      aria-labelledby="password-title"
      className="rounded-card border border-zinc-200 bg-white p-6 shadow-card"
    >
      <h2 id="password-title" className="text-base font-semibold tracking-tight">
        {copy.password.title}
      </h2>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        <TextField
          label={copy.password.current}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword}
        />
        <TextField
          label={copy.password.new}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword}
          description={copy.password.rule}
        />
        <div aria-live="polite">
          {strength ? (
            <>
              <div className="flex gap-1" aria-hidden>
                {STRENGTH_SEGMENTS.map((segment) => (
                  <span
                    key={segment}
                    className={`h-1 flex-1 rounded-full ${
                      segment <= STRENGTH_SEGMENT_COUNT_BY_LEVEL[strength]
                        ? STRENGTH_SEGMENT_CLASS[strength]
                        : 'bg-zinc-200'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-600">{`${copy.password.strengthLabel} ${copy.password.strength[strength]}`}</p>
            </>
          ) : null}
        </div>
        <TextField
          label={copy.password.confirm}
          name="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={fieldErrors.confirmation}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" isPending={change.isPending}>
            {copy.password.submit}
          </Button>
          {change.isSuccess ? (
            <p role="status" className="text-sm text-emerald-700">
              {copy.password.changed}
            </p>
          ) : null}
          {bannerMessage !== undefined ? (
            <p role="alert" className="text-sm text-rose-700">
              {bannerMessage}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
