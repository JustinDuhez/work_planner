import { formatMinutes, type CurrentUser } from '@work-planner/domain';
import { copy } from '../copy';
import { roleLabel } from '../session/role-label';
import { Avatar } from '../ui/avatar';
import { Stat } from '../ui/stat';
import { SummaryCard } from '../ui/summary-card';

/** Read-only account facts from /me; the editable names live in the form. */
export function IdentityCard({ user }: { user: CurrentUser }) {
  return (
    <SummaryCard title={copy.profile.identityTitle}>
      <div className="flex items-center gap-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} size="lg" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500">{copy.profile.emailHint}</p>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-zinc-500">{copy.profile.role}</dt>
          <dd className="mt-0.5 font-medium">{roleLabel(user.roles)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">{copy.profile.teams}</dt>
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
          <dt className="text-xs font-medium text-zinc-500">
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
      <Stat label={copy.profile.dailyTime} value={formatMinutes(user.dailyMinutes)} size="md" />
    </SummaryCard>
  );
}
