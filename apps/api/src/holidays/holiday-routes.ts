import {
  createPublicHolidayRequestSchema,
  holidayYearSchema,
  publicHolidayImportRequestSchema,
  workDateSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { clockViewerOf } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { parseInput } from '../http/parse-input';
import { addPublicHoliday, importFrenchHolidays, removePublicHoliday } from './holiday-commands';
import { findPublicHolidays } from './holiday-repository';

const holidayListQuerySchema = z.object({ year: z.coerce.number().pipe(holidayYearSchema) });
const holidayParamsSchema = z.object({ date: workDateSchema });

export function registerHolidayRoutes(
  scope: FastifyInstance,
  deps: { db: Kysely<Database> },
): void {
  // Everyone reads holidays: they shape everyone's week and calendar.
  scope.get('/api/v1/public-holidays', (request) => {
    const { year } = parseInput(holidayListQuerySchema, request.query);
    return findPublicHolidays(deps.db, { fromDate: `${year}-01-01`, toDate: `${year}-12-31` });
  });

  scope.post('/api/v1/public-holidays', async (request, reply) => {
    const body = parseInput(createPublicHolidayRequestSchema, request.body);
    const holiday = await addPublicHoliday(deps.db, {
      viewer: clockViewerOf(request, deps.db),
      ...body,
    });
    return reply.status(201).send(holiday);
  });

  scope.delete('/api/v1/public-holidays/:date', async (request, reply) => {
    const { date } = parseInput(holidayParamsSchema, request.params);
    await removePublicHoliday(deps.db, { viewer: clockViewerOf(request, deps.db), date });
    return reply.status(204).send();
  });

  scope.post('/api/v1/public-holiday-imports', async (request, reply) => {
    const { year } = parseInput(publicHolidayImportRequestSchema, request.body);
    const result = await importFrenchHolidays(deps.db, {
      viewer: clockViewerOf(request, deps.db),
      year,
    });
    return reply.status(201).send(result);
  });
}
