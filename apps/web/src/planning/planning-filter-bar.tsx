import { HOLIDAY_YEAR_MAX, HOLIDAY_YEAR_MIN, type TeamMonth } from '@work-planner/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { copy } from '../copy';

const monthTitle = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const navButtonClass =
  'rounded-control p-2 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50';

export interface PlanningFilters {
  yearMonth: string;
  team: number | 'all';
  isAbsentOnly: boolean;
}

export function PlanningFilterBar({
  filters,
  teamMonth,
  peopleCount,
  onChange,
  onShiftMonth,
}: {
  filters: PlanningFilters;
  teamMonth: TeamMonth | undefined;
  peopleCount: number;
  onChange: (filters: PlanningFilters) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const { yearMonth, team, isAbsentOnly } = filters;

  return (
    <>
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
          className="rounded-control border border-line-strong bg-white px-2 py-1"
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
          className="size-4"
        />
        {copy.planning.absentToday}
      </label>
      <p className="text-sm text-zinc-600">
        {`${peopleCount} ${peopleCount === 1 ? copy.planning.personSingular : copy.planning.personPlural}`}
      </p>
    </>
  );
}
