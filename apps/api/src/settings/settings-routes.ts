import { canManageSettings, updateSettingsRequestSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { clockViewerOf } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { parseInput } from '../http/parse-input';
import { SettingsForbiddenError } from './settings-errors';
import { readSettings, YEAR_START_KEY } from './settings-repository';

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
