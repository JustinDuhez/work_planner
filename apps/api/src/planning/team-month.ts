import {
  canResetCounter,
  datesOfIsoWeek,
  isoWeekOf,
  monthBounds,
  orderTeams,
  toWorkDate,
  type TeamMonth,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { buildWeekCounters } from '../counters/week-counters';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { findAbsentUserIds, findMonthHalfDays } from '../leave/leave-repository';
import { loadTeams } from '../teams/teams';

/** E7-D7: the whole company in one read; the page filters by team and absence itself. */
export async function buildTeamMonth(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; yearMonth: string },
): Promise<TeamMonth> {
  const month = monthBounds(query.yearMonth);
  const now = deps.now();
  const today = toWorkDate(now, deps.timeZone);
  const range = { fromDate: month.startDate, toDate: month.endDate };
  const [teamViews, people, holidays, halfDays, absentUserIds, actor] = await Promise.all([
    loadTeams(deps.db, query.viewer),
    deps.db
      .selectFrom('appUser')
      .select(['id', 'firstName', 'lastName', 'startDate', 'dailyMinutes'])
      .where('archivedAt', 'is', null)
      .execute(),
    findPublicHolidays(deps.db, range),
    findMonthHalfDays(deps.db, range),
    findAbsentUserIds(deps.db, today),
    query.viewer.loadActor(),
  ]);
  const teams = orderTeams(
    teamViews.map((team) => ({
      id: team.id,
      name: team.name,
      parentTeamId: team.parentTeamId,
      managerId: team.manager?.id ?? null,
      memberIds: team.members.map((member) => member.id),
    })),
  );
  const week = datesOfIsoWeek(isoWeekOf(today)) ?? [today];
  const currentWeek = { fromDate: week[0] ?? today, toDate: week.at(-1) ?? today };
  const result: TeamMonth['people'] = [];
  // ponytail: one E4 balance computation per person, one after another (≈6 queries each) so the
  // pool is never flooded; batch the counter facts if the company grows past a few dozen people.
  for (const person of people) {
    const { counters } = await buildWeekCounters(deps, {
      owner: person,
      week: currentWeek,
      instant: { now, today },
      viewer: query.viewer,
    });
    result.push({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      teamIds: teams
        .filter((team) => team.managerId === person.id || team.memberIds.includes(person.id))
        .map((team) => team.id),
      halfDays: halfDays
        .filter((halfDay) => halfDay.userId === person.id)
        .map(({ date, half, dayTypeCode, status }) => ({ date, half, dayTypeCode, status })),
      balance: {
        globalGapMinutes: counters.globalGapMinutes,
        hasOpenRefusal: counters.hasOpenRefusal,
      },
    });
  }
  return {
    month,
    today,
    holidays,
    teams,
    people: result,
    canResetUserIds: result
      .filter((person) => canResetCounter(actor, person.id))
      .map((person) => person.id),
    absentTodayUserIds: result
      .map((person) => person.id)
      .filter((id) => absentUserIds.includes(id)),
  };
}
