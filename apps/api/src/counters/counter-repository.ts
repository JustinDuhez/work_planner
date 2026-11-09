import type { CounterResetView, DailyMinutesChange } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export interface CounterProfile {
  id: number;
  startDate: string;
  dailyMinutes: number;
}

export interface StoredCounterReset {
  id: number;
  resetDate: string;
  authorName: string;
  createdAt: Date;
}

export function findCounterProfile(
  db: Kysely<Database>,
  userId: number,
): Promise<CounterProfile | undefined> {
  return db
    .selectFrom('appUser')
    .select(['id', 'startDate', 'dailyMinutes'])
    .where('id', '=', userId)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();
}

function counterResetQuery(db: Kysely<Database>) {
  return db
    .selectFrom('counterReset')
    .innerJoin('appUser as author', 'author.id', 'counterReset.authorId')
    .select([
      'counterReset.id',
      'counterReset.resetDate',
      'counterReset.createdAt',
      'author.firstName as authorFirstName',
      'author.lastName as authorLastName',
    ]);
}

type CounterResetRow = Awaited<
  ReturnType<ReturnType<typeof counterResetQuery>['executeTakeFirstOrThrow']>
>;

function toStoredCounterReset(row: CounterResetRow): StoredCounterReset {
  return {
    id: row.id,
    resetDate: row.resetDate,
    authorName: `${row.authorFirstName} ${row.authorLastName}`,
    createdAt: row.createdAt,
  };
}

/** The reset that applies is the most recently created one, whatever its date (E4-D3). */
export async function findApplyingCounterReset(
  db: Kysely<Database>,
  userId: number,
): Promise<StoredCounterReset | undefined> {
  const row = await counterResetQuery(db)
    .where('counterReset.userId', '=', userId)
    .orderBy('counterReset.createdAt', 'desc')
    .orderBy('counterReset.id', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row && toStoredCounterReset(row);
}

export async function findCounterResets(
  db: Kysely<Database>,
  userId: number,
): Promise<StoredCounterReset[]> {
  const rows = await counterResetQuery(db)
    .where('counterReset.userId', '=', userId)
    .orderBy('counterReset.createdAt', 'desc')
    .orderBy('counterReset.id', 'desc')
    .execute();
  return rows.map(toStoredCounterReset);
}

export async function findCounterResetById(
  db: Kysely<Database>,
  resetId: number,
): Promise<StoredCounterReset> {
  return toStoredCounterReset(
    await counterResetQuery(db).where('counterReset.id', '=', resetId).executeTakeFirstOrThrow(),
  );
}

export async function insertCounterReset(
  db: Kysely<Database>,
  reset: { userId: number; resetDate: string; authorId: number },
): Promise<number> {
  const { id } = await db
    .insertInto('counterReset')
    .values(reset)
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export function findDailyMinutesChanges(
  db: Kysely<Database>,
  userId: number,
): Promise<DailyMinutesChange[]> {
  return db
    .selectFrom('dailyMinutesChange')
    .select(['effectiveDate', 'previousDailyMinutes'])
    .where('userId', '=', userId)
    .execute();
}

export function toCounterResetView(reset: StoredCounterReset): CounterResetView {
  return {
    id: reset.id,
    resetDate: reset.resetDate,
    authorName: reset.authorName,
    createdAt: reset.createdAt.toISOString(),
  };
}
