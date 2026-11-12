import { createLeaveRequestRequestSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { parseInput } from '../http/parse-input';
import { createLeaveRequest } from './create-leave-request';
import { findDayTypes } from './leave-repository';
import { listLeaveRequestsToReview, listOwnLeaveRequests } from './read-leave-requests';

const leaveListQuerySchema = z.object({ view: z.enum(['mine', 'to-review'], 'Vue invalide.') });

export function registerLeaveRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.get('/api/v1/day-types', () => findDayTypes(deps.db));

  scope.post('/api/v1/leave-requests', async (request, reply) => {
    const body = parseInput(createLeaveRequestRequestSchema, request.body);
    const created = await createLeaveRequest(deps, {
      viewer: clockViewerOf(request, deps.db),
      ...body,
    });
    return reply.status(201).send(created);
  });

  scope.get('/api/v1/leave-requests', (request) => {
    const { view } = parseInput(leaveListQuerySchema, request.query);
    const viewer = clockViewerOf(request, deps.db);
    return view === 'mine'
      ? listOwnLeaveRequests(deps, viewer)
      : listLeaveRequestsToReview(deps, viewer);
  });
}
