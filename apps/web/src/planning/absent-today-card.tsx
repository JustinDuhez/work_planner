import type { PlanningSection, TeamMonth } from '@work-planner/domain';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { copy } from '../copy';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Stat } from '../ui/stat';
import { StatusMessage } from '../ui/status-message';
import { SummaryCard } from '../ui/summary-card';
import { CounterResetBatchDialog } from './counter-reset-batch-dialog';

/** Today's absentees among the people shown, and the bulk counter reset (managers / admins). */
export function AbsentTodayCard({
  teamMonth,
  sections,
  filterKey,
}: {
  teamMonth: TeamMonth;
  sections: readonly PlanningSection[];
  filterKey: string;
}) {
  const [isResetOpen, setIsResetOpen] = useState(false);
  // The success line belongs to the filters it was produced under: another choice hides it.
  const [resetDone, setResetDone] = useState<{ count: number; filterKey: string } | null>(null);
  const doneCount = resetDone?.filterKey === filterKey ? resetDone.count : null;
  const absentIds = new Set(teamMonth.absentTodayUserIds);
  const shownIds = new Set(sections.flatMap((section) => section.rows.map((row) => row.personId)));
  const absentees = teamMonth.people.filter(
    (person) => absentIds.has(person.id) && shownIds.has(person.id),
  );

  return (
    <SummaryCard title={copy.planning.absentToday}>
      <Stat label={copy.planning.absentCount} value={String(absentees.length)} />
      {absentees.length === 0 ? (
        <p className="text-sm text-zinc-600">{copy.planning.nobodyAbsent}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {absentees.map((person) => (
            <li key={person.id} className="flex items-center gap-2">
              <Avatar firstName={person.firstName} lastName={person.lastName} />
              {`${person.firstName} ${person.lastName}`}
            </li>
          ))}
        </ul>
      )}
      {teamMonth.canResetUserIds.length > 0 ? (
        <div className="space-y-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setIsResetOpen(true)}>
            <RotateCcw size={16} aria-hidden />
            {copy.planning.resetButton}
          </Button>
          <StatusMessage
            message={
              doneCount === null
                ? null
                : `${doneCount} ${doneCount === 1 ? copy.planning.counterSingular : copy.planning.counterPlural} ${copy.planning.resetDone}`
            }
            tone="success"
          />
        </div>
      ) : null}
      {isResetOpen ? (
        <CounterResetBatchDialog
          teamMonth={teamMonth}
          sections={[...sections]}
          onClose={() => setIsResetOpen(false)}
          onDone={(count) => setResetDone({ count, filterKey })}
        />
      ) : null}
    </SummaryCard>
  );
}
