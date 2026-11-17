import type { DirectoryEntry } from '@work-planner/domain';
import { copy } from '../copy';
import { Stat } from '../ui/stat';
import { SummaryCard } from '../ui/summary-card';

/** Counts over the whole loaded list (not the search / team filter). */
export function DirectorySummaryCard({
  entries,
  showArchived,
}: {
  entries: readonly DirectoryEntry[];
  showArchived: boolean;
}) {
  const active = entries.filter((entry) => !entry.isArchived);
  const teamCount = new Set(entries.flatMap((entry) => entry.teams.map((team) => team.name))).size;
  return (
    <SummaryCard title={copy.directory.summaryTitle}>
      <Stat label={copy.directory.peopleCount} value={String(active.length)} />
      <Stat label={copy.directory.teamCount} value={String(teamCount)} size="md" />
      {showArchived ? (
        <Stat
          label={copy.directory.archivedCount}
          value={String(entries.length - active.length)}
          size="md"
        />
      ) : null}
    </SummaryCard>
  );
}
