import {
  defaultTeamFilter,
  groupPeopleByTeam,
  HOLIDAY_YEAR_MAX,
  HOLIDAY_YEAR_MIN,
  isAbsentOn,
  toWorkDate,
  yearMonthSchema,
  type TeamMonth,
} from '@work-planner/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { copy } from '../copy';
import { useDayTypes } from '../leave/leave-queries';
import { useSession } from '../session/session-queries';
import { PersonCards } from './person-cards';
import { ALL_TEAMS, planningPath, useTeamMonth } from './planning-queries';
import { TeamMonthTable } from './team-month-table';

const monthTitle = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTHS_PER_YEAR = 12;

function shiftMonth(yearMonth: string, delta: number): string {
  const index = Number(yearMonth.slice(0, 4)) * MONTHS_PER_YEAR + Number(yearMonth.slice(5)) - 1;
  const shifted = index + delta;
  const month = (shifted % MONTHS_PER_YEAR) + 1;
  return `${Math.floor(shifted / MONTHS_PER_YEAR)}-${String(month).padStart(2, '0')}`;
}

function resolveTeam(requested: string | null, teamMonth: TeamMonth, viewerId: number) {
  if (requested === ALL_TEAMS) return 'all';
  const requestedId = Number(requested);
  return teamMonth.teams.some((team) => team.id === requestedId)
    ? requestedId
    : defaultTeamFilter(teamMonth.teams, viewerId);
}

const navButtonClass =
  'rounded-lg p-2 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50';

export function PlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const dayTypes = useDayTypes();
  const parsedMonth = yearMonthSchema.safeParse(searchParams.get('mois'));
  // Only here is the browser date read: the month comes from the URL otherwise.
  const yearMonth = parsedMonth.success
    ? parsedMonth.data
    : toWorkDate(new Date(), APP_TIME_ZONE).slice(0, 7);
  const { data, isPending, isError } = useTeamMonth(yearMonth);
  if (!session) return null;

  const isAbsentOnly = searchParams.get('absents') === '1';
  // Before any payload exists the URL's own choice is kept, so a quick click never rewrites it.
  const requestedTeam = searchParams.get('equipe');
  const urlTeam =
    requestedTeam === ALL_TEAMS || !Number(requestedTeam) ? 'all' : Number(requestedTeam);
  const team = data ? resolveTeam(requestedTeam, data, session.user.id) : urlTeam;
  const nonBadgeableCodes = new Set(
    (dayTypes.data ?? []).filter((type) => !type.isBadgeable).map((type) => type.code),
  );
  const sections = data
    ? groupPeopleByTeam(data.teams, data.people, copy.planning.noTeam)
        .filter((section) => team === 'all' || section.teamId === team)
        .map((section) => ({
          ...section,
          rows: isAbsentOnly
            ? section.rows.filter((row) =>
                isAbsentOn(
                  data.people.find((person) => person.id === row.personId)?.halfDays ?? [],
                  data.today,
                  nonBadgeableCodes,
                ),
              )
            : section.rows,
        }))
        .filter((section) => section.rows.length > 0)
    : [];
  const peopleCount = new Set(sections.flatMap((section) => section.rows.map((r) => r.personId)))
    .size;
  // Filters replace the history entry; months push one so Back steps through them.
  const goTo = (filters: { yearMonth: string; team: number | 'all'; isAbsentOnly: boolean }) =>
    void navigate(planningPath(filters), { replace: filters.yearMonth === yearMonth });
  const goToMonth = (delta: number) =>
    goTo({ yearMonth: shiftMonth(yearMonth, delta), team, isAbsentOnly });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.planning.title}</h1>
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={copy.planning.previousMonth}
            disabled={yearMonth <= `${HOLIDAY_YEAR_MIN}-01`}
            onClick={() => goToMonth(-1)}
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
            onClick={() => goToMonth(1)}
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
              goTo({
                yearMonth,
                team: event.target.value === 'all' ? 'all' : Number(event.target.value),
                isAbsentOnly,
              })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary-600"
          >
            <option value="all">{copy.planning.allTeams}</option>
            {data?.teams.map((option) => (
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
            onChange={(event) => goTo({ yearMonth, team, isAbsentOnly: event.target.checked })}
            className="size-4 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          {copy.planning.absentToday}
        </label>
        <p className="text-sm text-zinc-600">
          {`${peopleCount} ${peopleCount === 1 ? copy.planning.personSingular : copy.planning.personPlural}`}
        </p>
        {/* Task 5: the bulk reset button and its status line go here. */}
      </div>
      <div key={yearMonth} className="motion-safe:animate-[week-in_200ms_ease-out]">
        {isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {copy.planning.loadError}
          </p>
        ) : null}
        {isPending && !isError ? (
          <p className="text-sm text-zinc-500">{copy.planning.loading}</p>
        ) : null}
        {data && sections.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {isAbsentOnly ? copy.planning.nobodyAbsent : copy.planning.noPeople}
          </p>
        ) : null}
        {data && sections.length > 0 ? (
          <>
            <div className="hidden md:block">
              <TeamMonthTable teamMonth={data} sections={sections} dayTypes={dayTypes.data ?? []} />
            </div>
            <div className="md:hidden">
              <PersonCards teamMonth={data} sections={sections} dayTypes={dayTypes.data ?? []} />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
