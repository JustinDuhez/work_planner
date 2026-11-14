import { yearMonthSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockViewerOf, type ClockDependencies } from '../clock/clock-dependencies';
import { parseInput } from '../http/parse-input';
import { buildTeamMonth } from './team-month';

const teamMonthParamsSchema = z.object({ yearMonth: yearMonthSchema });

export function registerPlanningRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.get('/api/v1/team-months/:yearMonth', (request) => {
    const { yearMonth } = parseInput(teamMonthParamsSchema, request.params);
    return buildTeamMonth(deps, { viewer: clockViewerOf(request, deps.db), yearMonth });
  });
}
