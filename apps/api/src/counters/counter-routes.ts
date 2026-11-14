import {
  createCounterResetRequestSchema,
  createCounterResetsRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { createCounterReset, createCounterResets, listCounterResets } from './counter-resets';

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

  scope.post('/api/v1/counter-resets', async (request, reply) => {
    const { userIds, resetDate } = parseInput(createCounterResetsRequestSchema, request.body ?? {});
    const resets = await createCounterResets(deps, {
      viewer: clockViewerOf(request, deps.db),
      userIds,
      resetDate,
    });
    return reply.status(201).send({ resets });
  });

  scope.get('/api/v1/users/:userId/counter-resets', (request) => {
    const { userId } = parseInput(ownerParamsSchema, request.params);
    return listCounterResets(deps, { viewer: clockViewerOf(request, deps.db), ownerId: userId });
  });
}
