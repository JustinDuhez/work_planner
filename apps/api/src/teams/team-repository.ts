import type { TeamLink } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

/**
 * Locks every team row: tree checks look at the whole tree, so two concurrent moves must not each
 * see the other's old parent. ponytail: one lock for all teams, fine at company scale.
 */
export async function lockTeamTree(trx: Kysely<Database>): Promise<TeamLink[]> {
  return trx.selectFrom('team').select(['id', 'parentTeamId']).orderBy('id').forUpdate().execute();
}

/** Active people among `userIds`: anyone else cannot manage or join a team. */
export async function countActivePeople(
  db: Kysely<Database>,
  userIds: readonly number[],
): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = await db
    .selectFrom('appUser')
    .select('id')
    .where('id', 'in', [...userIds])
    .where('archivedAt', 'is', null)
    .execute();
  return rows.length;
}

/** Replaces the active members; archived people's memberships are history (E2a-D5) and stay. */
export async function replaceActiveMembers(
  trx: Kysely<Database>,
  teamId: number,
  memberIds: readonly number[],
): Promise<void> {
  let removal = trx
    .deleteFrom('teamMember')
    .where('teamId', '=', teamId)
    .where('userId', 'in', trx.selectFrom('appUser').select('id').where('archivedAt', 'is', null));
  if (memberIds.length > 0) removal = removal.where('userId', 'not in', [...memberIds]);
  await removal.execute();
  if (memberIds.length === 0) return;
  await trx
    .insertInto('teamMember')
    .values(memberIds.map((userId) => ({ teamId, userId })))
    .onConflict((conflict) => conflict.columns(['teamId', 'userId']).doNothing())
    .execute();
}
