import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../db/database';

async function selectActiveUserIds(
  db: Kysely<Database>,
  query: RawBuilder<{ id: number }>,
): Promise<Set<number>> {
  const { rows } = await query.execute(db);
  return new Set(rows.map((row) => row.id));
}

/** Recursive: every member and sub-team manager below the teams `managerId` manages. */
export function findManagedUserIds(db: Kysely<Database>, managerId: number): Promise<Set<number>> {
  // UNION (not UNION ALL) also makes the recursion stop if a cycle ever exists.
  return selectActiveUserIds(
    db,
    sql<{ id: number }>`
      WITH RECURSIVE managed_team (id) AS (
        SELECT id FROM team WHERE manager_id = ${managerId}
        UNION
        SELECT child.id FROM team AS child
          JOIN managed_team ON child.parent_team_id = managed_team.id
      )
      SELECT app_user.id FROM app_user
      WHERE app_user.archived_at IS NULL
        AND app_user.id <> ${managerId}
        AND app_user.id IN (
          SELECT team_member.user_id FROM team_member
            JOIN managed_team ON team_member.team_id = managed_team.id
          UNION
          SELECT team.manager_id FROM team
            JOIN managed_team ON team.parent_team_id = managed_team.id
          WHERE team.manager_id IS NOT NULL
        )
    `,
  );
}

/** Not recursive: members of the teams `managerId` manages and managers of their child teams. */
export function findDirectReportIds(db: Kysely<Database>, managerId: number): Promise<Set<number>> {
  return selectActiveUserIds(
    db,
    sql<{ id: number }>`
      SELECT app_user.id FROM app_user
      WHERE app_user.archived_at IS NULL
        AND app_user.id <> ${managerId}
        AND app_user.id IN (
          SELECT team_member.user_id FROM team_member
            JOIN team ON team.id = team_member.team_id
          WHERE team.manager_id = ${managerId}
          UNION
          SELECT child.manager_id FROM team AS child
            JOIN team AS parent ON parent.id = child.parent_team_id
          WHERE parent.manager_id = ${managerId} AND child.manager_id IS NOT NULL
        )
    `,
  );
}

/** The inverse of findDirectReportIds. */
export function findDirectManagerIds(db: Kysely<Database>, userId: number): Promise<Set<number>> {
  return selectActiveUserIds(
    db,
    sql<{ id: number }>`
      SELECT app_user.id FROM app_user
      WHERE app_user.archived_at IS NULL
        AND app_user.id <> ${userId}
        AND app_user.id IN (
          SELECT team.manager_id FROM team
            JOIN team_member ON team_member.team_id = team.id
          WHERE team_member.user_id = ${userId} AND team.manager_id IS NOT NULL
          UNION
          SELECT parent.manager_id FROM team AS child
            JOIN team AS parent ON parent.id = child.parent_team_id
          WHERE child.manager_id = ${userId} AND parent.manager_id IS NOT NULL
        )
    `,
  );
}

export async function isTeamManager(db: Kysely<Database>, userId: number): Promise<boolean> {
  const managedTeam = await db
    .selectFrom('team')
    .select('id')
    .where('managerId', '=', userId)
    .limit(1)
    .executeTakeFirst();
  return managedTeam !== undefined;
}
