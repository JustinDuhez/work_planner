import { loadConfig } from './config/config';
import { loadDotEnvIfPresent } from './config/load-env';
import { createDb } from './db/create-db';
import { seedDatabase } from './seed/seed-database';
import { loadSeedConfig } from './seed/seed-config';

// A run configured by the shell (production) must use exactly what the shell provides: a stray
// .env file must never supply the admin credentials of the production database.
if (process.env.DATABASE_URL === undefined) {
  loadDotEnvIfPresent();
}
const config = loadConfig(process.env);
const seedConfig = loadSeedConfig(process.env);
const db = createDb(config.databaseUrl);

try {
  const { userCount, teamCount, membershipCount } = await seedDatabase(db, seedConfig);
  console.log(`Seed done: ${userCount} users, ${teamCount} teams, ${membershipCount} memberships.`);
} finally {
  await db.destroy();
}
