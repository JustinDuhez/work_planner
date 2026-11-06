import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentUserSchema, type CurrentUser, type SessionResponse } from '@work-planner/domain';
import { useState, type FormEvent } from 'react';
import { ApiError, apiSend } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { roleLabel } from '../session/role-label';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { Button } from '../ui/button';
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
      className="rounded-card border border-zinc-200 bg-white p-6 shadow-card"
    >
      <h2 id="profile-info-title" className="text-base font-semibold tracking-tight">
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
        <TextField
          label={copy.profile.email}
          name="email"
          type="email"
          value={user.email}
          readOnly
          description={copy.profile.emailHint}
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">{copy.profile.role}</dt>
            <dd className="mt-0.5 font-medium">{roleLabel(user.roles)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{copy.profile.teams}</dt>
            <dd className="mt-0.5 font-medium">
              {user.teams.length === 0
                ? copy.profile.noTeam
                : user.teams.map((team) => (
                    <span key={team.id} className="block">
                      {team.name} {team.isManager ? copy.profile.teamManagerSuffix : null}
                    </span>
                  ))}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">
              {user.directManagers.length > 1 ? copy.profile.managers : copy.profile.manager}
            </dt>
            <dd className="mt-0.5 font-medium">
              {user.directManagers.length === 0
                ? copy.profile.noManager
                : user.directManagers.map((manager) => (
                    <span key={manager.id} className="block">
                      {manager.firstName} {manager.lastName}
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-3">
          <Button type="submit" isPending={save.isPending}>
            {copy.profile.saveInfo}
          </Button>
          {save.isSuccess ? (
            <p role="status" className="text-sm text-emerald-700">
              {copy.profile.infoSaved}
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
