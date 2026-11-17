import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentUserSchema, type CurrentUser, type SessionResponse } from '@work-planner/domain';
import { useState, type FormEvent } from 'react';
import { ApiError, apiSend } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { Button } from '../ui/button';
import { StatusMessage } from '../ui/status-message';
import { TextField } from '../ui/text-field';

export function ProfileInfoForm({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const save = useMutation({
    mutationFn: () => apiSend('PATCH', '/api/v1/me', { firstName, lastName }, currentUserSchema),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<SessionResponse | null>(SESSION_QUERY_KEY, (session) =>
        session ? { ...session, user: updatedUser } : session,
      );
    },
  });
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const bannerMessage = bannerMessageFor(save.error, ['firstName', 'lastName']);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.reset();
    save.mutate();
  }

  return (
    <section
      aria-labelledby="profile-info-title"
      className="rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <h2 id="profile-info-title" className="text-sm font-semibold text-zinc-900">
        {copy.profile.infoTitle}
      </h2>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={copy.profile.firstName}
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={setFirstName}
            error={fieldErrors.firstName}
          />
          <TextField
            label={copy.profile.lastName}
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={setLastName}
            error={fieldErrors.lastName}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" isPending={save.isPending}>
            {copy.profile.saveInfo}
          </Button>
          <StatusMessage message={save.isSuccess ? copy.profile.infoSaved : null} tone="success" />
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
