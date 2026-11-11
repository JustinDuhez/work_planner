import type { UserSummary } from '@work-planner/domain';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { clockWeekPath, currentIsoWeek } from '../clock/clock-time';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { useTeams } from './team-queries';
import { buildTeamTree, type TeamNode } from './team-tree';

function memberCountLabel(count: number): string {
  if (count === 0) return copy.teams.noMembers;
  return `${count} ${count === 1 ? copy.teams.memberCountOne : copy.teams.memberCountMany}`;
}

function TeamItem({
  node,
  teamActions,
  ownUserId,
}: {
  node: TeamNode;
  teamActions?: (node: TeamNode) => ReactNode;
  ownUserId: number | undefined;
}) {
  const { team, children } = node;
  const isoWeek = currentIsoWeek(new Date());
  const managerLabel = team.manager
    ? `${copy.teams.manager} ${team.manager.firstName} ${team.manager.lastName}`
    : copy.teams.noManager;
  return (
    <li
      role="treeitem"
      aria-label={team.name}
      aria-expanded={children.length > 0 ? true : undefined}
      className="space-y-2"
    >
      <div className="rounded-card border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-zinc-900">{team.name}</p>
            <p className="text-sm text-zinc-600">{managerLabel}</p>
          </div>
          <div className="flex gap-2">{teamActions?.(node)}</div>
        </div>
        <details open className="mt-2 text-sm">
          <summary className="cursor-pointer text-zinc-600">
            {memberCountLabel(team.members.length)}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {team.members.map((member: UserSummary) => (
              <li key={member.id}>
                <Link
                  to={clockWeekPath(member.id === ownUserId ? undefined : member.id, isoWeek)}
                  className="text-zinc-800 hover:text-primary-600"
                >
                  {`${member.firstName} ${member.lastName}`}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
      {children.length > 0 ? (
        <ul role="group" className="space-y-2 border-l border-zinc-200 pl-4">
          {children.map((child) => (
            <TeamItem
              key={child.team.id}
              node={child}
              teamActions={teamActions}
              ownUserId={ownUserId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TeamsPage({
  toolbar,
  teamActions,
}: {
  toolbar?: ReactNode;
  teamActions?: (node: TeamNode) => ReactNode;
}) {
  const { data: session } = useSession();
  const teams = useTeams();
  const tree = buildTeamTree(teams.data ?? []);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{copy.teams.title}</h1>
        {toolbar}
      </div>
      {teams.isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.teams.loadError}
        </p>
      ) : null}
      {teams.isPending ? <p className="text-sm text-zinc-500">{copy.teams.loading}</p> : null}
      {teams.data && tree.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.teams.empty}</p>
      ) : null}
      {tree.length > 0 ? (
        <ul role="tree" aria-label={copy.teams.title} className="space-y-2">
          {tree.map((node) => (
            <TeamItem
              key={node.team.id}
              node={node}
              teamActions={teamActions}
              ownUserId={session?.user.id}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
