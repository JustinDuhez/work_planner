import { useId, useRef, useState, type ReactNode } from 'react';
import { Users } from 'lucide-react';
import { currentIsoWeek } from '../clock/clock-time';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { PageLayout } from '../ui/page-layout';
import { LoadingRegion, Skeleton } from '../ui/skeleton';
import { SummarySkeleton } from '../ui/summary-skeleton';
import { TeamMembersCard } from './team-members-card';
import { useTeams } from './team-queries';
import { buildTeamTree, type TeamNode } from './team-tree';

function memberCountLabel(count: number): string {
  return `${count} ${count > 1 ? copy.teams.memberCountMany : copy.teams.memberCountOne}`;
}

function flatten(nodes: readonly TeamNode[]): TeamNode['team'][] {
  return nodes.flatMap((node) => [node.team, ...flatten(node.children)]);
}

function TeamItem({
  node,
  teamActions,
  selectedId,
  onSelect,
}: {
  node: TeamNode;
  teamActions?: (node: TeamNode) => ReactNode;
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}) {
  const nameId = useId();
  const { team, children } = node;
  const actions = teamActions?.(node);
  return (
    <li aria-labelledby={nameId} className="space-y-2">
      <div
        data-selected={team.id === selectedId}
        className="relative rounded-card border border-line bg-surface p-3 hover:border-line-strong data-[selected=true]:border-primary-500 data-[selected=true]:ring-1 data-[selected=true]:ring-primary-500"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <button
              id={nameId}
              type="button"
              aria-pressed={team.id === selectedId}
              onClick={() => onSelect(team.id)}
              className="font-medium text-zinc-900 after:absolute after:inset-0 after:rounded-card hover:text-primary-600 hover:underline aria-pressed:font-semibold aria-pressed:text-primary-700"
            >
              {team.name}
            </button>
            <span className="text-sm text-zinc-600">
              <span aria-hidden="true">· </span>
              {team.manager
                ? `${team.manager.firstName} ${team.manager.lastName}`
                : copy.teams.noManager}
            </span>
            <span className="text-sm text-zinc-600">
              <span aria-hidden="true">· </span>
              {memberCountLabel(team.members.length)}
            </span>
          </div>
          {actions ? (
            <div className="relative z-10 flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
      {children.length > 0 ? (
        <ul className="space-y-2 border-l border-line pl-4">
          {children.map((child) => (
            <TeamItem
              key={child.team.id}
              node={child}
              teamActions={teamActions}
              selectedId={selectedId}
              onSelect={onSelect}
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
  const [pickedId, setPickedId] = useState<number>();
  const asideRef = useRef<HTMLDivElement>(null);
  // Below lg the members card sits above the tree: bring it into view after a pick.
  const pick = (id: number) => {
    setPickedId(id);
    asideRef.current?.scrollIntoView?.({ block: 'nearest' });
  };
  const tree = buildTeamTree(teams.data ?? []);
  const isoWeek = currentIsoWeek(new Date());
  const ownUserId = session?.user.id;
  const ordered = flatten(tree);
  const selected =
    ordered.find((team) => team.id === pickedId) ??
    ordered.find((team) => team.manager?.id === ownUserId) ??
    ordered.find((team) => team.members.some((member) => member.id === ownUserId)) ??
    ordered[0];

  const bar = (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-balance">{copy.teams.title}</h1>
      {toolbar}
    </>
  );
  const main = (
    <>
      {teams.isError && !teams.data ? (
        <ErrorState
          message={copy.teams.loadError}
          onRetry={() => void teams.refetch()}
          isRetrying={teams.isFetching}
        />
      ) : null}
      {teams.isPending && !teams.isError ? (
        <LoadingRegion label={copy.teams.loading}>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </LoadingRegion>
      ) : null}
      {teams.data && tree.length === 0 ? (
        <EmptyState icon={Users} message={copy.teams.empty} />
      ) : null}
      {tree.length > 0 ? (
        <ul aria-label={copy.teams.title} className="space-y-2">
          {tree.map((node) => (
            <TeamItem
              key={node.team.id}
              node={node}
              teamActions={teamActions}
              selectedId={selected?.id}
              onSelect={pick}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
  const aside = selected ? (
    <div ref={asideRef} className="scroll-mt-32">
      <TeamMembersCard team={selected} ownUserId={ownUserId} isoWeek={isoWeek} />
    </div>
  ) : teams.isPending && !teams.isError ? (
    <SummarySkeleton />
  ) : null;

  return (
    <section>
      <PageLayout bar={bar} main={main} aside={aside} />
    </section>
  );
}
