import { sql, type Kysely } from 'kysely';
import { Migrator } from 'kysely/migration';
import { insertCounterReset, insertDailyMinutesChange, insertUser } from '../test/fixtures';
import { assertIsTestDatabaseUrl, createMigratedTestDb } from '../test/test-database';
import { createDb } from './create-db';
import type { Database } from './database';
import { MIGRATIONS_DIRECTORY, migrateToLatest } from './migrator';
import { createSqlFileMigrationProvider } from './sql-file-migration-provider';

describe('counter schema', () => {
  let db: Kysely<Database>;
  let userId: number;
  let authorId: number;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    userId = await insertUser(db, { email: 'counter.schema@example.com' });
    authorId = await insertUser(db, { email: 'counter.author@example.com' });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('stores a person start date as a calendar day', async () => {
    const user = await db
      .selectFrom('appUser')
      .select('startDate')
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();

    expect(user.startDate).toBe('2026-11-02');
  });

  it('keeps every reset of a person as history', async () => {
    await insertCounterReset(db, { userId, resetDate: '2026-11-03', authorId });
    await insertCounterReset(db, { userId, resetDate: '2026-11-04', authorId });

    const resets = await db
      .selectFrom('counterReset')
      .select('resetDate')
      .where('userId', '=', userId)
      .execute();
    expect(resets.map((reset) => reset.resetDate).sort()).toEqual(['2026-11-03', '2026-11-04']);
  });

  it('refuses two daily-time changes on the same day for a person', async () => {
    await insertDailyMinutesChange(db, {
      userId,
      effectiveDate: '2026-11-09',
      previousDailyMinutes: 420,
      authorId,
    });

    await expect(
      insertDailyMinutesChange(db, {
        userId,
        effectiveDate: '2026-11-09',
        previousDailyMinutes: 360,
        authorId,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('refuses a previous daily time out of range', async () => {
    await expect(
      insertDailyMinutesChange(db, {
        userId,
        effectiveDate: '2026-11-16',
        previousDailyMinutes: 0,
        authorId,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a reset for a person that does not exist', async () => {
    await expect(
      insertCounterReset(db, { userId: 999_999, resetDate: '2026-11-03', authorId }),
    ).rejects.toMatchObject({
      code: '23503',
    });
  });
});

describe('start date backfill', () => {
  it("sets existing people's start date to their Paris creation day", async () => {
    const db = createDb(assertIsTestDatabaseUrl(process.env.TEST_DATABASE_URL));
    try {
      await sql`DROP SCHEMA public CASCADE`.execute(db);
      await sql`CREATE SCHEMA public`.execute(db);
      const migrator = new Migrator({
        db,
        provider: createSqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
      });
      const { error } = await migrator.migrateTo('0003_clock');
      expect(error).toBeUndefined();
      // 23:30 UTC on 5 November is already 6 November in Paris.
      await sql`
        INSERT INTO app_user (email, password_hash, first_name, last_name, created_at)
        VALUES ('backfill@example.com', 'x', 'Back', 'Fill', '2026-11-05T23:30:00Z')
      `.execute(db);

      await migrateToLatest(db, MIGRATIONS_DIRECTORY);

      const user = await db
        .selectFrom('appUser')
        .select('startDate')
        .where('email', '=', 'backfill@example.com')
        .executeTakeFirstOrThrow();
      expect(user.startDate).toBe('2026-11-06');
    } finally {
      await db.destroy();
    }
  });
});
