import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './database';

const CONNECTION_TIMEOUT_IN_MILLISECONDS = 5_000;
const MAX_POOL_SIZE = 10;

// A DATE is a calendar day, not an instant: converting it to a JS Date would shift it
// with the server time zone. Keep the raw 'YYYY-MM-DD' string.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export function createDb(databaseUrl: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: databaseUrl,
        max: MAX_POOL_SIZE,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_IN_MILLISECONDS,
      }),
    }),
    plugins: [new CamelCasePlugin()],
  });
}
