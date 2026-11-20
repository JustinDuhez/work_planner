import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../db/database';

const WAIT_STEP_MS = 25;
const WAIT_LIMIT_MS = 5_000;

/**
 * Deterministic interleaving: locks the given user rows in a separate transaction, starts the
 * requests, waits until every one is blocked on a row lock in Postgres (and none has finished),
 * then commits. A command that takes no row lock would finish early and fail this helper.
 */
export async function holdRowLock<T>(
  db: Kysely<Database>,
  userIds: number | number[],
  start: () => Promise<T>[],
): Promise<T[]> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let locked!: () => void;
  const lockTaken = new Promise<void>((resolve) => (locked = resolve));
  const holder = db.transaction().execute(async (trx) => {
    await trx
      .selectFrom('appUser')
      .select('id')
      .where('id', 'in', ids)
      .orderBy('id')
      .forNoKeyUpdate()
      .execute();
    locked();
    await released;
  });
  await lockTaken;

  const requests = start();
  const settled = new Set<number>();
  requests.forEach((request, index) => void request.then(() => settled.add(index)));
  const deadline = Date.now() + WAIT_LIMIT_MS;
  for (;;) {
    const { rows } = await sql<{ waiting: string }>`
      select count(*) as waiting from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`.execute(db);
    if (Number(rows[0]?.waiting) >= requests.length) break;
    if (settled.size > 0 || Date.now() > deadline) {
      release();
      await holder;
      await Promise.allSettled(requests);
      throw new Error(
        `Requests were not all blocked on the row lock (${settled.size} finished early)`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
  release();
  await holder;
  return Promise.all(requests);
}
