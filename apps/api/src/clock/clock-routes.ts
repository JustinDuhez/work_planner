import {
  isoWeekSchema,
  startClockPeriodRequestSchema,
  updateClockDayRequestSchema,
  updateClockPeriodRequestSchema,
  workDateSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../http/parse-input';
import {
  deleteClockPeriod,
  setClockDayMode,
  startClockPeriod,
  updateClockPeriod,
} from './clock-commands';
import { clockViewerOf, type ClockDependencies } from './clock-dependencies';
import { buildClockWeek } from './clock-week';

const clockWeekParamsSchema = z.object({
  userId: z.coerce.number().int().positive('Utilisateur invalide.').max(2_147_483_647),
  isoWeek: isoWeekSchema,
});

const periodParamsSchema = z.object({
  id: z.coerce.number().int().positive('Période invalide.').max(2_147_483_647),
});
const dayParamsSchema = z.object({ date: workDateSchema });

export function registerClockRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.get('/api/v1/users/:userId/clock-weeks/:isoWeek', (request) => {
    const { userId, isoWeek } = parseInput(clockWeekParamsSchema, request.params);
    return buildClockWeek(deps, {
      ownerId: userId,
      isoWeek,
      viewer: clockViewerOf(request, deps.db),
    });
  });

  scope.post('/api/v1/clock-periods', async (request, reply) => {
    const body = parseInput(startClockPeriodRequestSchema, request.body ?? {});
    const period = await startClockPeriod(deps, {
      viewer: clockViewerOf(request, deps.db),
      ...body,
    });
    return reply.status(201).send(period);
  });

  scope.patch('/api/v1/clock-periods/:id', (request) => {
    const { id } = parseInput(periodParamsSchema, request.params);
    const body = parseInput(updateClockPeriodRequestSchema, request.body);
    return updateClockPeriod(deps, {
      viewer: clockViewerOf(request, deps.db),
      periodId: id,
      ...body,
    });
  });

  scope.delete('/api/v1/clock-periods/:id', async (request, reply) => {
    const { id } = parseInput(periodParamsSchema, request.params);
    await deleteClockPeriod(deps, { viewer: clockViewerOf(request, deps.db), periodId: id });
    return reply.status(204).send();
  });

  scope.patch('/api/v1/clock-days/:date', (request) => {
    const { date } = parseInput(dayParamsSchema, request.params);
    const { workMode } = parseInput(updateClockDayRequestSchema, request.body);
    return setClockDayMode(deps, { viewer: clockViewerOf(request, deps.db), date, workMode });
  });
}
