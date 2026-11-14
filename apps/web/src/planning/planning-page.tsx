import {
  defaultTeamFilter,
  groupPeopleByTeam,
  isAbsentOn,
  toWorkDate,
  yearMonthSchema,
  type TeamMonth,
} from '@work-planner/domain';
import { useNavigate, useSearchParams } from 'react-router';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { copy } from '../copy';
import { useDayTypes } from '../leave/leave-queries';
import { useSession } from '../session/session-queries';
import { PersonCards } from './person-cards';
import { PlanningFilterBar, type PlanningFilters } from './planning-filter-bar';
import { ALL_TEAMS, planningPath, useTeamMonth } from './planning-queries';
import { TeamMonthTable } from './team-month-table';

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
  const { data, isPending, isError, isPlaceholderData } = useTeamMonth(yearMonth);
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
  const goTo = (filters: PlanningFilters) =>
    void navigate(planningPath(filters), { replace: filters.yearMonth === yearMonth });
  const goToMonth = (delta: number) =>
    goTo({ yearMonth: shiftMonth(yearMonth, delta), team, isAbsentOnly });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.planning.title}</h1>
      <PlanningFilterBar
        filters={{ yearMonth, team, isAbsentOnly }}
        teamMonth={data}
        sections={sections}
        peopleCount={peopleCount}
        onChange={goTo}
        onShiftMonth={goToMonth}
      />
      <div key={yearMonth} className="motion-safe:animate-[week-in_200ms_ease-out]">
        {isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {copy.planning.loadError}
          </p>
        ) : null}
        {(isPending || isPlaceholderData) && !isError ? (
          <p className="text-sm text-zinc-500">{copy.planning.loading}</p>
        ) : null}
        {data && !isPlaceholderData && sections.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {isAbsentOnly ? copy.planning.nobodyAbsent : copy.planning.noPeople}
          </p>
        ) : null}
        {data && !isPlaceholderData && sections.length > 0 ? (
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
