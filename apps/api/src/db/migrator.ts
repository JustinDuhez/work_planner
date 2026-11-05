import path from 'node:path';
import type { Kysely } from 'kysely';
import { Migrator } from 'kysely/migration';
import type { Database } from './database';
import { createSqlFileMigrationProvider } from './sql-file-migration-provider';

/** Scripts always run from the apps/api workspace directory (npm --workspace, Docker WORKDIR). */
export const MIGRATIONS_DIRECTORY = path.resolve('migrations');

export async function migrateToLatest(
  db: Kysely<Database>,
  migrationsDirectory: string,
): Promise<string[]> {
  const migrator = new Migrator({
    db,
    provider: createSqlFileMigrationProvider(migrationsDirectory),
  });
  const { error, results = [] } = await migrator.migrateToLatest();
  if (error) {
    const failedMigration = results.find((result) => result.status === 'Error')?.migrationName;
    throw new Error(failedMigration ? `Migration failed: ${failedMigration}` : 'Migration failed', {
      cause: error,
    });
  }
  return results
    .filter((result) => result.status === 'Success')
    .map((result) => result.migrationName);
}
