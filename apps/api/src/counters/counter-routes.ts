import { createCounterResetRequestSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { createCounterReset, listCounterResets } from './counter-resets';

const ownerParamsSchema = z.object({ userId: databaseIdSchema('Utilisateur invalide.') });

export function registerCounterRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.post('/api/v1/users/:userId/counter-resets', async (request, reply) => {
    const { userId } = parseInput(ownerParamsSchema, request.params);
    const { resetDate } = parseInput(createCounterResetRequestSchema, request.body ?? {});
    const reset = await createCounterReset(deps, {
      viewer: clockViewerOf(request, deps.db),
      ownerId: userId,
      resetDate,
    });
    return reply.status(201).send(reset);
  });

  scope.get('/api/v1/users/:userId/counter-resets', (request) => {
    const { userId } = parseInput(ownerParamsSchema, request.params);
    return listCounterResets(deps, { viewer: clockViewerOf(request, deps.db), ownerId: userId });
  });
}
