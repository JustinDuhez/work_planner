import { compareFrench, formatMinutes, type DirectoryEntry } from '@work-planner/domain';
import { SearchX } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { clockWeekPath, currentIsoWeek, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { roleLabel } from '../session/role-label';
import { ErrorState } from '../ui/error-state';
import { EmptyState } from '../ui/empty-state';
import { LoadingRegion, Skeleton } from '../ui/skeleton';
import { useSession } from '../session/session-queries';
import { useDirectory } from './directory-queries';

function workingTimeLabel(entry: DirectoryEntry): string | null {
  if (!entry.workingTime) return null;
  const { dailyMinutes, plannedChange } = entry.workingTime;
  const current = formatMinutes(dailyMinutes);
  return plannedChange
    ? `${current} · ${formatMinutes(plannedChange.dailyMinutes)} ${copy.directory.from} ${formatLongDate(plannedChange.effectiveDate)}`
    : current;
}

function matchesSearch(entry: DirectoryEntry, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase('fr-FR');
  if (needle === '') return true;
  return `${entry.firstName} ${entry.lastName} ${entry.email}`
    .toLocaleLowerCase('fr-FR')
    .includes(needle);
}

const CELL = 'block py-1 text-zinc-600 sm:table-cell sm:px-3 sm:py-2';
const CARD_LABEL = 'block text-xs font-medium text-zinc-500 sm:hidden';
const HEADER = 'px-3 py-2';

export function DirectoryPage({
  toolbar,
  rowAction,
  includeArchived = false,
}: {
  toolbar?: ReactNode;
  rowAction?: (entry: DirectoryEntry) => ReactNode;
  includeArchived?: boolean;
}) {
  const { data: session } = useSession();
  const directory = useDirectory(includeArchived);
  const [search, setSearch] = useState('');
  const [teamName, setTeamName] = useState('');
  const isoWeek = currentIsoWeek(new Date());
  const teamNames = useMemo(
    () =>
      [
        ...new Set((directory.data ?? []).flatMap((entry) => entry.teams.map((team) => team.name))),
      ].sort((first, second) => compareFrench(first, second)),
    [directory.data],
  );
  const entries = (directory.data ?? []).filter(
    (entry) =>
      matchesSearch(entry, search) &&
      (teamName === '' || entry.teams.some((team) => team.name === teamName)),
  );

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-balance">{copy.directory.title}</h1>
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <input
          type="search"
          aria-label={copy.directory.search}
          placeholder={copy.directory.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 min-w-48 flex-1 rounded-control border border-line bg-white px-3 text-sm"
        />
        <select
          aria-label={copy.directory.teamFilter}
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          className="h-9 rounded-control border border-line bg-white px-2 text-sm"
        >
          <option value="">{copy.directory.allTeams}</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {toolbar}
      </div>
      {directory.isError && !directory.data ? (
        <ErrorState message={copy.directory.loadError} onRetry={() => void directory.refetch()} />
      ) : null}
      {directory.isPending && !directory.isError ? (
        <LoadingRegion label={copy.directory.loading}>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </LoadingRegion>
      ) : null}
      {directory.data && entries.length === 0 ? (
        <EmptyState icon={SearchX} message={copy.directory.empty} />
      ) : null}
      {entries.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="hidden text-left text-xs uppercase tracking-wide text-zinc-500 sm:table-header-group">
            <tr>
              <th className={HEADER}>{copy.directory.columnName}</th>
              <th className={HEADER}>{copy.directory.columnEmail}</th>
              <th className={HEADER}>{copy.directory.columnTeams}</th>
              <th className={HEADER}>{copy.directory.columnManagers}</th>
              <th className={HEADER}>{copy.directory.columnRole}</th>
              <th className={HEADER}>{copy.directory.columnWorkingTime}</th>
              <th className={HEADER}>
                <span className="sr-only">{copy.directory.manage}</span>
              </th>
            </tr>
          </thead>
          <tbody className="space-y-3 sm:space-y-0">
            {entries.map((entry) => {
              const name = `${entry.firstName} ${entry.lastName}`;
              return (
                // Stacked cards on phones (block layout), a table row from `sm`.
                <tr
                  key={entry.id}
                  aria-label={name}
                  className="block rounded-card border border-line bg-white p-4 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:p-0"
                >
                  <td className="block py-1 sm:table-cell sm:px-3 sm:py-2">
                    {entry.isArchived ? (
                      <span className="font-medium text-zinc-900">{name}</span>
                    ) : (
                      <Link
                        to={clockWeekPath(
                          entry.id === session?.user.id ? undefined : entry.id,
                          isoWeek,
                        )}
                        className="font-medium text-zinc-900 hover:text-primary-600"
                      >
                        {name}
                      </Link>
                    )}
                    {entry.isBlocked ? (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {copy.directory.blocked}
                      </span>
                    ) : null}
                    {entry.isArchived ? (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {copy.directory.archivedBadge}
                      </span>
                    ) : null}
                  </td>
                  <td className={CELL}>
                    <span className={CARD_LABEL}>{copy.directory.columnEmail}</span>
                    {entry.email}
                  </td>
                  <td className={CELL}>
                    <span className={CARD_LABEL}>{copy.directory.columnTeams}</span>
                    {entry.teams.map((team) => team.name).join(', ')}
                  </td>
                  <td className={CELL}>
                    <span className={CARD_LABEL}>{copy.directory.columnManagers}</span>
                    {entry.managers
                      .map((manager) => `${manager.firstName} ${manager.lastName}`)
                      .join(', ')}
                  </td>
                  <td className={CELL}>
                    <span className={CARD_LABEL}>{copy.directory.columnRole}</span>
                    {roleLabel(entry)}
                  </td>
                  <td className={`${CELL} tabular-nums`}>
                    <span className={CARD_LABEL}>{copy.directory.columnWorkingTime}</span>
                    {workingTimeLabel(entry)}
                    {entry.workingTime ? (
                      <span className="block text-xs text-zinc-500">
                        {copy.directory.startDate} {formatLongDate(entry.workingTime.startDate)}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${CELL} text-right`}>{rowAction?.(entry)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
