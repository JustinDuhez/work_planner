import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './database';

const CONNECTION_TIMEOUT_IN_MILLISECONDS = 5_000;
const MAX_POOL_SIZE = 10;

// A DATE is a calendar day, not an instant: converting it to a JS Date would shift it
// with the server time zone. Keep the raw 'YYYY-MM-DD' string.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: MAX_POOL_SIZE,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_IN_MILLISECONDS,
    // Every session in UTC: local Windows Postgres runs Europe/Paris, CI and Neon run UTC.
    // Nothing should depend on the session time zone, but this keeps all environments alike.
    options: '-c TimeZone=UTC',
  });
  // An idle connection dropped by the server (e.g. Neon suspending compute) emits 'error';
  // without a listener Node would crash the whole process. The pool is created before
  // Fastify's logger exists, hence console.
  pool.on('error', (error) => {
    console.error('Idle database connection lost', error);
  });
  return pool;
}

export function createDb(databaseUrl: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: createPool(databaseUrl) }),
    plugins: [new CamelCasePlugin()],
  });
}
