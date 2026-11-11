import {
  canManageSettings,
  DEFAULT_YEAR_START,
  updateSettingsRequestSchema,
  type Settings,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { clockViewerOf } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { parseInput } from '../http/parse-input';
import { SettingsForbiddenError } from './settings-errors';

const YEAR_START_KEY = 'year_start';

async function readSettings(db: Kysely<Database>): Promise<Settings> {
  const row = await db
    .selectFrom('setting')
    .select('value')
    .where('key', '=', YEAR_START_KEY)
    .executeTakeFirst();
  // Migration 0001 inserts the row; the default only guards a database restored without it.
  return { yearStart: row?.value ?? DEFAULT_YEAR_START };
}

export function registerSettingsRoutes(
  scope: FastifyInstance,
  deps: { db: Kysely<Database> },
): void {
  scope.get('/api/v1/settings', () => readSettings(deps.db));

  scope.patch('/api/v1/settings', async (request) => {
    if (!canManageSettings(await clockViewerOf(request, deps.db).loadActor())) {
      throw new SettingsForbiddenError();
    }
    const { yearStart } = parseInput(updateSettingsRequestSchema, request.body);
    await deps.db
      .insertInto('setting')
      .values({ key: YEAR_START_KEY, value: yearStart })
      .onConflict((conflict) => conflict.column('key').doUpdateSet({ value: yearStart }))
      .execute();
    return readSettings(deps.db);
  });
}
