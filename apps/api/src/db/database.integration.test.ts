import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sql, type Kysely } from 'kysely';
import { createMigratedTestDb } from '../test/test-database';
import type { Database } from './database';
import { MIGRATIONS_DIRECTORY, migrateToLatest } from './migrator';

describe('database', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates the setting table with the default year start on 1 July', async () => {
    const yearStart = await db
      .selectFrom('setting')
      .select('value')
      .where('key', '=', 'year_start')
      .executeTakeFirstOrThrow();

    expect(yearStart.value).toBe('07-01');
  });

  it('applies nothing when migrations run again on an up-to-date database', async () => {
    await expect(migrateToLatest(db, MIGRATIONS_DIRECTORY)).resolves.toEqual([]);
  });

  it('refreshes updated_at automatically when a row changes', async () => {
    const before = await db
      .selectFrom('setting')
      .select('updatedAt')
      .where('key', '=', 'year_start')
      .executeTakeFirstOrThrow();

    await db
      .updateTable('setting')
      .set({ value: '09-01' })
      .where('key', '=', 'year_start')
      .execute();

    const after = await db
      .selectFrom('setting')
      .select('updatedAt')
      .where('key', '=', 'year_start')
      .executeTakeFirstOrThrow();
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('returns DATE columns as YYYY-MM-DD strings so no time zone can shift the day', async () => {
    const { rows } = await sql<{ day: string }>`SELECT DATE '2026-03-29' AS day`.execute(db);

    expect(rows[0]?.day).toBe('2026-03-29');
  });

  it('rejects a broken migration and leaves nothing behind', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'migrations-'));
    try {
      await copyFile(
        path.join(MIGRATIONS_DIRECTORY, '0001_setting.sql'),
        path.join(directory, '0001_setting.sql'),
      );
      await writeFile(path.join(directory, '0002_broken.sql'), 'CREATE TABLE broken (;');

      const failure = await migrateToLatest(db, directory).catch((error: unknown) => error);

      expect(failure).toEqual(expect.objectContaining({ message: 'Migration failed' }));
      expect((failure as Error).cause).toBeDefined();
      await expect(migrateToLatest(db, MIGRATIONS_DIRECTORY)).resolves.toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
