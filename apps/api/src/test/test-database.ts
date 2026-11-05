import { sql, type Kysely } from 'kysely';
import { createDb } from '../db/create-db';
import type { Database } from '../db/database';
import { MIGRATIONS_DIRECTORY, migrateToLatest } from '../db/migrator';

const TEST_DATABASE_NAME_SUFFIX = '_test';

export function assertIsTestDatabaseUrl(testDatabaseUrl: string | undefined): string {
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is not set (see apps/api/.env.example).');
  }
  // Guard: the reset below drops every table, so it must never target a real database.
  if (!new URL(testDatabaseUrl).pathname.endsWith(TEST_DATABASE_NAME_SUFFIX)) {
    throw new Error(
      `TEST_DATABASE_URL must name a database ending with "${TEST_DATABASE_NAME_SUFFIX}".`,
    );
  }
  return testDatabaseUrl;
}

export async function createMigratedTestDb(): Promise<Kysely<Database>> {
  const db = createDb(assertIsTestDatabaseUrl(process.env.TEST_DATABASE_URL));
  await sql`DROP SCHEMA public CASCADE`.execute(db);
  await sql`CREATE SCHEMA public`.execute(db);
  await migrateToLatest(db, MIGRATIONS_DIRECTORY);
  return db;
}
