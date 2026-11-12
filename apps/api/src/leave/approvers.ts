import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { findDirectManagerIds } from '../organization/scope-repository';

/**
 * E1-D6: the requester's direct managers and every admin, never the requester. Blocked people
 * cannot log in, so they never count as someone who can approve.
 */
export async function findLeaveApproverIds(
  db: Kysely<Database>,
  requesterId: number,
): Promise<number[]> {
  const directManagerIds = [...(await findDirectManagerIds(db, requesterId))];
  const rows = await db
    .selectFrom('appUser')
    .select('id')
    .where('archivedAt', 'is', null)
    .where('isBlocked', '=', false)
    .where('id', '<>', requesterId)
    .where((eb) =>
      directManagerIds.length > 0
        ? eb.or([eb('isAdmin', '=', true), eb('id', 'in', directManagerIds)])
        : eb('isAdmin', '=', true),
    )
    .orderBy('id')
    .execute();
  return rows.map((row) => row.id);
}
