import {
  createUserRequestSchema,
  resetPasswordRequestSchema,
  updateUserRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { loadDirectory } from './directory';
import { createUser, resetUserPassword, updateUser } from './user-commands';

const directoryQuerySchema = z.object({ archived: z.enum(['true', 'false']).optional() });
const userParamsSchema = z.object({ id: databaseIdSchema('Utilisateur invalide.') });

export function registerUserRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  // Everyone may see everyone (CDC, F2.3); archived people only in the admin list.
  scope.get('/api/v1/users', (request) => {
    const { archived } = parseInput(directoryQuerySchema, request.query);
    return loadDirectory(deps, {
      viewer: clockViewerOf(request, deps.db),
      includeArchived: archived === 'true',
    });
  });

  scope.post('/api/v1/users', async (request, reply) => {
    const body = parseInput(createUserRequestSchema, request.body);
    const entry = await createUser(deps, { viewer: clockViewerOf(request, deps.db), ...body });
    return reply.status(201).send(entry);
  });

  scope.patch('/api/v1/users/:id', (request) => {
    const { id } = parseInput(userParamsSchema, request.params);
    const body = parseInput(updateUserRequestSchema, request.body);
    return updateUser(deps, { viewer: clockViewerOf(request, deps.db), userId: id, ...body });
  });

  scope.put('/api/v1/users/:id/password', async (request, reply) => {
    const { id } = parseInput(userParamsSchema, request.params);
    const { newPassword } = parseInput(resetPasswordRequestSchema, request.body);
    await resetUserPassword(deps, {
      viewer: clockViewerOf(request, deps.db),
      userId: id,
      newPassword,
    });
    return reply.status(204).send();
  });
}
