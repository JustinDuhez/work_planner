import { createClockCorrectionRequestSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { parseInput } from '../http/parse-input';
import { createClockCorrection } from './create-correction';

export function registerCorrectionRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.post('/api/v1/clock-corrections', async (request, reply) => {
    const body = parseInput(createClockCorrectionRequestSchema, request.body);
    const correction = await createClockCorrection(deps, {
      viewer: clockViewerOf(request, deps.db),
      ...body,
    });
    return reply.status(201).send(correction);
  });
}
