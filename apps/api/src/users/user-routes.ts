import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { findActiveUserSummaries } from './user-repository';

export function registerUserRoutes(scope: FastifyInstance, deps: { db: Kysely<Database> }): void {
  // Everyone may see everyone (CDC); only names leave the server here.
  scope.get('/api/v1/users', () => findActiveUserSummaries(deps.db));
}
