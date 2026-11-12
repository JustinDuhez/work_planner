import {
  createLeaveRequestRequestSchema,
  reviewLeaveRequestRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { cancelLeaveRequest } from './cancel-leave-request';
import { createLeaveRequest } from './create-leave-request';
import { findDayTypes } from './leave-repository';
import { listLeaveRequestsToReview, listOwnLeaveRequests } from './read-leave-requests';
import { reviewLeaveRequest } from './review-leave-request';

const leaveParamsSchema = z.object({ id: databaseIdSchema('Demande invalide.') });

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

  scope.put('/api/v1/leave-requests/:id/review', (request) => {
    const { id } = parseInput(leaveParamsSchema, request.params);
    const body = parseInput(reviewLeaveRequestRequestSchema, request.body);
    return reviewLeaveRequest(deps, {
      viewer: clockViewerOf(request, deps.db),
      requestId: id,
      ...body,
    });
  });

  scope.put('/api/v1/leave-requests/:id/cancellation', (request) => {
    const { id } = parseInput(leaveParamsSchema, request.params);
    parseInput(z.strictObject({}, { error: 'Champs non autorisés.' }), request.body ?? {});
    return cancelLeaveRequest(deps, { viewer: clockViewerOf(request, deps.db), requestId: id });
  });
}
