import {
  answerClockCorrectionRequestSchema,
  clockCorrectionStatusSchema,
  createClockCorrectionRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { answerClockCorrection } from './answer-correction';
import { createClockCorrection } from './create-correction';
import { findVisibleCorrection, listClockCorrections } from './read-corrections';

const correctionParamsSchema = z.object({ id: databaseIdSchema('Correction invalide.') });
const ownerParamsSchema = z.object({ userId: databaseIdSchema('Utilisateur invalide.') });
const listQuerySchema = z.object({ statut: clockCorrectionStatusSchema.optional() });

export function registerCorrectionRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.post('/api/v1/clock-corrections', async (request, reply) => {
    const body = parseInput(createClockCorrectionRequestSchema, request.body);
    const correction = await createClockCorrection(deps, {
      viewer: clockViewerOf(request, deps.db),
      ...body,
    });
    return reply.status(201).send(correction);
  });

  scope.get('/api/v1/clock-corrections/:id', (request) => {
    const { id } = parseInput(correctionParamsSchema, request.params);
    return findVisibleCorrection(deps, {
      viewer: clockViewerOf(request, deps.db),
      correctionId: id,
    });
  });

  scope.patch('/api/v1/clock-corrections/:id', (request) => {
    const { id } = parseInput(correctionParamsSchema, request.params);
    const body = parseInput(answerClockCorrectionRequestSchema, request.body);
    return answerClockCorrection(deps, {
      viewer: clockViewerOf(request, deps.db),
      correctionId: id,
      ...body,
    });
  });

  scope.get('/api/v1/users/:userId/clock-corrections', (request) => {
    const { userId } = parseInput(ownerParamsSchema, request.params);
    const { statut } = parseInput(listQuerySchema, request.query);
    return listClockCorrections(deps, {
      viewer: clockViewerOf(request, deps.db),
      ownerId: userId,
      status: statut,
    });
  });
}
