import type { CurrentUser } from '@work-planner/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/database';
import { findDirectManagerIds } from './scope-repository';

export async function loadCurrentUser(db: Kysely<Database>, userId: number): Promise<CurrentUser> {
  const user = await db
    .selectFrom('appUser')
    .select(['id', 'email', 'firstName', 'lastName', 'dailyMinutes', 'isAdmin'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const teams = await db
    .selectFrom('team')
    .select([
      'team.id',
      'team.name',
      sql<boolean>`team.manager_id IS NOT DISTINCT FROM ${userId}`.as('isManager'),
    ])
    .where((eb) =>
      eb.or([
        eb('team.managerId', '=', userId),
        eb.exists(
          eb
            .selectFrom('teamMember')
            .select('teamMember.teamId')
            .whereRef('teamMember.teamId', '=', 'team.id')
            .where('teamMember.userId', '=', userId),
        ),
      ]),
    )
    .orderBy('team.name')
    .execute();
  const directManagerIds = [...(await findDirectManagerIds(db, userId))];
  const directManagers =
    directManagerIds.length === 0
      ? []
      : await db
          .selectFrom('appUser')
          .select(['id', 'firstName', 'lastName'])
          .where('id', 'in', directManagerIds)
          .orderBy('lastName')
          .orderBy('firstName')
          .execute();
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    dailyMinutes: user.dailyMinutes,
    roles: { isAdmin: user.isAdmin, isManager: teams.some((team) => team.isManager) },
    teams,
    directManagers,
    mustChangePassword: false,
  };
}
