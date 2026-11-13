import { DEFAULT_YEAR_START, type Settings } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export const YEAR_START_KEY = 'year_start';

export async function readSettings(db: Kysely<Database>): Promise<Settings> {
  const row = await db
    .selectFrom('setting')
    .select('value')
    .where('key', '=', YEAR_START_KEY)
    .executeTakeFirst();
  // Migration 0001 inserts the row; the default only guards a database restored without it.
  return { yearStart: row?.value ?? DEFAULT_YEAR_START };
}
