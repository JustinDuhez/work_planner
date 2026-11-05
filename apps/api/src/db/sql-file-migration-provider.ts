import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'kysely';
import type { Migration, MigrationProvider } from 'kysely/migration';

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

export function createSqlFileMigrationProvider(directory: string): MigrationProvider {
  return {
    async getMigrations() {
      const fileNames = (await readdir(directory))
        .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
        .sort();

      const migrations: Record<string, Migration> = {};
      for (const fileName of fileNames) {
        const statements = await readFile(path.join(directory, fileName), 'utf8');
        migrations[fileName.replace(/\.sql$/, '')] = {
          async up(db) {
            await sql.raw(statements).execute(db);
          },
        };
      }
      return migrations;
    },
  };
}
