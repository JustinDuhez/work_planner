import type { UserSummary } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export function findActiveUserSummaries(db: Kysely<Database>): Promise<UserSummary[]> {
  return db
    .selectFrom('appUser')
    .select(['id', 'firstName', 'lastName'])
    .where('archivedAt', 'is', null)
    .orderBy('lastName')
    .orderBy('firstName')
    .execute();
}

export function findActiveUserSummary(
  db: Kysely<Database>,
  userId: number,
): Promise<UserSummary | undefined> {
  return db
    .selectFrom('appUser')
    .select(['id', 'firstName', 'lastName'])
    .where('id', '=', userId)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();
}
