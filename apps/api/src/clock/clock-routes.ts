import { isoWeekSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../http/parse-input';
import { clockViewerOf, type ClockDependencies } from './clock-dependencies';
import { buildClockWeek } from './clock-week';

const clockWeekParamsSchema = z.object({
  userId: z.coerce.number().int().positive('Utilisateur invalide.'),
  isoWeek: isoWeekSchema,
});

export function registerClockRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.get('/api/v1/users/:userId/clock-weeks/:isoWeek', (request) => {
    const { userId, isoWeek } = parseInput(clockWeekParamsSchema, request.params);
    return buildClockWeek(deps, {
      ownerId: userId,
      isoWeek,
      viewer: clockViewerOf(request, deps.db),
    });
  });
}
