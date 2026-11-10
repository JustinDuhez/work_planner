import { formatMinutes, type DirectoryEntry } from '@work-planner/domain';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { clockWeekPath, currentIsoWeek, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { roleLabel } from '../session/role-label';
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

const CELL = 'block py-0.5 text-zinc-600 sm:table-cell sm:px-3 sm:py-2';
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
      ].sort((first, second) => first.localeCompare(second, 'fr')),
    [directory.data],
  );
  const entries = (directory.data ?? []).filter(
    (entry) =>
      matchesSearch(entry, search) &&
      (teamName === '' || entry.teams.some((team) => team.name === teamName)),
  );

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.directory.title}</h1>
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <input
          type="search"
          aria-label={copy.directory.search}
          placeholder={copy.directory.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 min-w-48 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
        />
        <select
          aria-label={copy.directory.teamFilter}
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
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
      {directory.isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.directory.loadError}
        </p>
      ) : null}
      {directory.isPending ? (
        <p className="text-sm text-zinc-500">{copy.directory.loading}</p>
      ) : null}
      {directory.data && entries.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.directory.empty}</p>
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
          <tbody className="space-y-2 sm:space-y-0">
            {entries.map((entry) => {
              const name = `${entry.firstName} ${entry.lastName}`;
              return (
                // Stacked cards on phones (block layout), a table row from `sm`.
                <tr
                  key={entry.id}
                  aria-label={name}
                  className="block rounded-card border border-zinc-200 bg-white p-3 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:p-0"
                >
                  <td className="block py-0.5 sm:table-cell sm:px-3 sm:py-2">
                    <Link
                      to={clockWeekPath(
                        entry.id === session?.user.id ? undefined : entry.id,
                        isoWeek,
                      )}
                      className="font-medium text-zinc-900 hover:text-primary-600"
                    >
                      {name}
                    </Link>
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
                  <td className={CELL}>{entry.email}</td>
                  <td className={CELL}>{entry.teams.map((team) => team.name).join(', ')}</td>
                  <td className={CELL}>
                    {entry.managers
                      .map((manager) => `${manager.firstName} ${manager.lastName}`)
                      .join(', ')}
                  </td>
                  <td className={CELL}>{roleLabel(entry)}</td>
                  <td className={`${CELL} tabular-nums`}>{workingTimeLabel(entry)}</td>
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
