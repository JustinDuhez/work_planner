import {
  canManageTeams,
  compareFrench,
  comparePeopleByName,
  type TeamView,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { ClockViewer } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { TeamNotFoundError } from './team-errors';

// French order, not the database collation (E8a).
async function findTeams(db: Kysely<Database>, teamId?: number) {
  let teams = db
    .selectFrom('team')
    .leftJoin('appUser as manager', (join) =>
      join.onRef('manager.id', '=', 'team.managerId').on('manager.archivedAt', 'is', null),
    )
    .select([
      'team.id',
      'team.name',
      'team.parentTeamId',
      'manager.id as managerId',
      'manager.firstName as managerFirstName',
      'manager.lastName as managerLastName',
    ]);
  if (teamId !== undefined) teams = teams.where('team.id', '=', teamId);
  let members = db
    .selectFrom('teamMember')
    .innerJoin('appUser', 'appUser.id', 'teamMember.userId')
    .where('appUser.archivedAt', 'is', null)
    .select(['teamMember.teamId', 'appUser.id', 'appUser.firstName', 'appUser.lastName']);
  if (teamId !== undefined) members = members.where('teamMember.teamId', '=', teamId);
  return Promise.all([teams.execute(), members.execute()]);
}

async function buildTeams(
  db: Kysely<Database>,
  query: { viewer: ClockViewer; teamId?: number },
): Promise<TeamView[]> {
  const [[teams, members], actor] = await Promise.all([
    findTeams(db, query.teamId),
    query.viewer.loadActor(),
  ]);
  const canManage = canManageTeams(actor);
  return [...teams]
    .sort((first, second) => compareFrench(first.name, second.name))
    .map((team) => ({
      id: team.id,
      name: team.name,
      parentTeamId: team.parentTeamId,
      manager:
        team.managerId === null || team.managerFirstName === null || team.managerLastName === null
          ? null
          : {
              id: team.managerId,
              firstName: team.managerFirstName,
              lastName: team.managerLastName,
            },
      members: members
        .filter((member) => member.teamId === team.id)
        .sort(comparePeopleByName)
        .map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
      canManage,
    }));
}

/** Everyone sees the whole tree (F2.2 tree view, read-only for non-admins). */
export function loadTeams(db: Kysely<Database>, viewer: ClockViewer): Promise<TeamView[]> {
  return buildTeams(db, { viewer });
}

export async function loadTeam(
  db: Kysely<Database>,
  query: { viewer: ClockViewer; teamId: number },
): Promise<TeamView> {
  const [team] = await buildTeams(db, query);
  if (!team) throw new TeamNotFoundError();
  return team;
}
