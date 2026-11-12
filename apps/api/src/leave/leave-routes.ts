import type { FastifyInstance } from 'fastify';
import type { ClockDependencies } from '../clock/clock-dependencies';
import { findDayTypes } from './leave-repository';

export function registerLeaveRoutes(scope: FastifyInstance, deps: ClockDependencies): void {
  scope.get('/api/v1/day-types', () => findDayTypes(deps.db));
}
