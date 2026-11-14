import {
  absenceRuns,
  formatDayMonth,
  type AbsenceRun,
  type DayTypeView,
  type PlanningSection,
  type TeamMonth,
} from '@work-planner/domain';
import { Link } from 'react-router';
import { Gap } from '../clock/counters-card';
import { copy } from '../copy';

function runText(run: AbsenceRun, dayTypes: readonly DayTypeView[]): string {
  const label = dayTypes.find((type) => type.code === run.dayTypeCode)?.label ?? run.dayTypeCode;
  const pending = run.status === 'pending' ? ` ${copy.calendar.pending}` : '';
  if (run.startDate !== run.endDate) {
    return `${label} · ${formatDayMonth(run.startDate)} – ${formatDayMonth(run.endDate)}${pending}`;
  }
  const isWholeDay = run.startHalf === 'am' && run.endHalf === 'pm';
  const halfWord = run.startHalf === 'am' ? copy.calendar.morning : copy.calendar.afternoon;
  return `${label} · ${formatDayMonth(run.startDate)}${isWholeDay ? '' : ` ${halfWord}`}${pending}`;
}

export function PersonCards({
  teamMonth,
  sections,
  dayTypes,
}: {
  teamMonth: TeamMonth;
  sections: readonly PlanningSection[];
  dayTypes: readonly DayTypeView[];
}) {
  const personById = new Map(teamMonth.people.map((person) => [person.id, person]));
  const teamPathById = new Map(teamMonth.teams.map((team) => [team.id, team.path]));
  const shownIds = [
    ...new Set(sections.flatMap((section) => section.rows.map((row) => row.personId))),
  ];
  return (
    <ul aria-label={copy.planning.cardsLabel} className="space-y-3">
      {shownIds.flatMap((id) => {
        const person = personById.get(id);
        if (!person) return [];
        const name = `${person.firstName} ${person.lastName}`;
        const runs = absenceRuns(person.halfDays);
        const teamPaths = person.teamIds.flatMap((teamId) => teamPathById.get(teamId) ?? []);
        return [
          <li
            key={id}
            aria-label={name}
            className="rounded-card border border-zinc-200 bg-white p-3 text-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Link
                to={`/calendrier/${id}`}
                className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                {name}
              </Link>
              <Gap
                minutes={person.balance.globalGapMinutes}
                isRefused={person.balance.hasOpenRefusal}
                className="text-xs"
              />
              {person.balance.hasOpenRefusal ? (
                <span className="sr-only">{copy.planning.openRefusal}</span>
              ) : null}
            </div>
            <p className="text-xs text-zinc-600">{teamPaths.join(', ') || copy.planning.noTeam}</p>
            {runs.length === 0 ? (
              <p className="mt-1 text-zinc-500">{copy.planning.noAbsence}</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {runs.map((run) => (
                  <li key={`${run.startDate}:${run.startHalf}`}>{runText(run, dayTypes)}</li>
                ))}
              </ul>
            )}
          </li>,
        ];
      })}
    </ul>
  );
}
