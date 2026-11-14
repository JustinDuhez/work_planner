import {
  HOLIDAY_YEAR_MAX,
  HOLIDAY_YEAR_MIN,
  type PlanningSection,
  type TeamMonth,
} from '@work-planner/domain';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { CounterResetBatchDialog } from './counter-reset-batch-dialog';

const monthTitle = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const navButtonClass =
  'rounded-lg p-2 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50';

export interface PlanningFilters {
  yearMonth: string;
  team: number | 'all';
  isAbsentOnly: boolean;
}

export function PlanningFilterBar({
  filters,
  teamMonth,
  sections,
  peopleCount,
  onChange,
  onShiftMonth,
}: {
  filters: PlanningFilters;
  teamMonth: TeamMonth | undefined;
  sections: PlanningSection[];
  peopleCount: number;
  onChange: (filters: PlanningFilters) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const { yearMonth, team, isAbsentOnly } = filters;
  const [isResetOpen, setIsResetOpen] = useState(false);
  // The success line belongs to the filters it was produced under: another choice hides it.
  const [resetDone, setResetDone] = useState<{ count: number; filterKey: string } | null>(null);
  const filterKey = `${yearMonth}|${team}|${isAbsentOnly}`;
  const doneCount = resetDone?.filterKey === filterKey ? resetDone.count : null;

  return (
    <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={copy.planning.previousMonth}
          disabled={yearMonth <= `${HOLIDAY_YEAR_MIN}-01`}
          onClick={() => onShiftMonth(-1)}
          className={navButtonClass}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="min-w-36 text-center text-base font-semibold first-letter:uppercase">
          {monthTitle.format(new Date(`${yearMonth}-01T12:00:00Z`))}
        </p>
        <button
          type="button"
          aria-label={copy.planning.nextMonth}
          disabled={yearMonth >= `${HOLIDAY_YEAR_MAX}-12`}
          onClick={() => onShiftMonth(1)}
          className={navButtonClass}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        {copy.planning.teamFilter}
        <select
          value={team}
          onChange={(event) =>
            onChange({
              yearMonth,
              team: event.target.value === 'all' ? 'all' : Number(event.target.value),
              isAbsentOnly,
            })
          }
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          <option value="all">{copy.planning.allTeams}</option>
          {teamMonth?.teams.map((option) => (
            <option key={option.id} value={option.id}>
              {option.path}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isAbsentOnly}
          onChange={(event) => onChange({ yearMonth, team, isAbsentOnly: event.target.checked })}
          className="size-4 focus-visible:outline-2 focus-visible:outline-primary-600"
        />
        {copy.planning.absentToday}
      </label>
      <p className="text-sm text-zinc-600">
        {`${peopleCount} ${peopleCount === 1 ? copy.planning.personSingular : copy.planning.personPlural}`}
      </p>
      {teamMonth && teamMonth.canResetUserIds.length > 0 ? (
        <Button variant="secondary" onClick={() => setIsResetOpen(true)}>
          <RotateCcw size={16} aria-hidden />
          {copy.planning.resetButton}
        </Button>
      ) : null}
      {doneCount === null ? null : (
        <p role="status" className="basis-full text-sm text-emerald-800">
          {`${doneCount} ${doneCount === 1 ? copy.planning.counterSingular : copy.planning.counterPlural} ${copy.planning.resetDone}`}
        </p>
      )}
      {isResetOpen && teamMonth ? (
        <CounterResetBatchDialog
          teamMonth={teamMonth}
          sections={sections}
          onClose={() => setIsResetOpen(false)}
          onDone={(count) => setResetDone({ count, filterKey })}
        />
      ) : null}
    </div>
  );
}
