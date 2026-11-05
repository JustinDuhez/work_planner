import { loadConfig } from './config/config';
import { loadDotEnvIfPresent } from './config/load-env';
import { createDb } from './db/create-db';
import { MIGRATIONS_DIRECTORY, migrateToLatest } from './db/migrator';

loadDotEnvIfPresent();
const config = loadConfig(process.env);
const db = createDb(config.migrationDatabaseUrl);

try {
  const appliedMigrations = await migrateToLatest(db, MIGRATIONS_DIRECTORY);
  console.log(
    appliedMigrations.length > 0
      ? `Applied migrations: ${appliedMigrations.join(', ')}`
      : 'Database already up to date.',
  );
} finally {
  await db.destroy();
}
