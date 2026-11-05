import type { ErrorResponse, HealthResponse } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/database';

const DATABASE_UNAVAILABLE: ErrorResponse = {
  code: 'DATABASE_UNAVAILABLE',
  message: 'Base de données indisponible.',
};

export function registerHealthRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get('/api/v1/health', async (request, reply) => {
    try {
      await sql`SELECT 1`.execute(db);
    } catch (error) {
      request.log.error({ err: error }, 'Database health check failed');
      return reply.status(503).send(DATABASE_UNAVAILABLE);
    }
    const health: HealthResponse = { status: 'ok', database: 'up' };
    return health;
  });
}
