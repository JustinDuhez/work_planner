import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { parseInput } from '../http/parse-input';
import { loadDirectory } from './directory';

const directoryQuerySchema = z.object({ archived: z.enum(['true', 'false']).optional() });

export function registerUserRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  // Everyone may see everyone (CDC, F2.3); archived people only in the admin list.
  scope.get('/api/v1/users', (request) => {
    const { archived } = parseInput(directoryQuerySchema, request.query);
    return loadDirectory(deps, {
      viewer: clockViewerOf(request, deps.db),
      includeArchived: archived === 'true',
    });
  });
}
