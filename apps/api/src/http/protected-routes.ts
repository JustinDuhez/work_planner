import type { FastifyInstance } from 'fastify';

/** The only API routes reachable without a session. Everything else is protected by default. */
export const PUBLIC_API_ROUTES: ReadonlySet<string> = new Set([
  'POST /api/v1/sessions',
  'DELETE /api/v1/sessions/current',
  'GET /api/v1/health',
]);

/**
 * Routes registered through this scope inherit requireAuth (and the CSRF token check it does on
 * unsafe methods): a new route cannot forget it.
 */
export async function registerProtectedRoutes(
  app: FastifyInstance,
  register: (scope: FastifyInstance) => void,
): Promise<void> {
  await app.register((scope, _options, done) => {
    scope.addHook('onRequest', scope.requireAuth);
    register(scope);
    done();
  });
}
