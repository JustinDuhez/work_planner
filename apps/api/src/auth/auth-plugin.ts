import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CsrfInvalidError, PasswordChangeRequiredError, UnauthenticatedError } from './auth-errors';
import { resolveSession, type AuthDependencies, type ResolvedSession } from './session-service';
import { isSameSecret } from './session-token';

export const SESSION_COOKIE_NAME = 'wp_session';
const CSRF_HEADER_NAME = 'x-csrf-token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// E2a-D2: a password typed by an admin opens nothing but the screen that replaces it.
// (Logout is a public route, so it keeps working.)
const ROUTES_OPEN_DURING_PASSWORD_CHANGE: ReadonlySet<string> = new Set([
  'GET /api/v1/me',
  'PUT /api/v1/me/password',
]);

declare module 'fastify' {
  interface FastifyRequest {
    authSession: ResolvedSession | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
  }
}

function isUnsafe(request: FastifyRequest): boolean {
  return UNSAFE_METHODS.has(request.method);
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

export async function registerAuth(app: FastifyInstance, deps: AuthDependencies): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, { global: false });
  app.decorateRequest('authSession', null);

  // Same-origin check on every state-changing request, login included (login CSRF).
  app.addHook('onRequest', (request, _reply, done) => {
    const ownOrigin = `${request.protocol}://${request.host}`;
    const isForeign = isUnsafe(request) && readHeader(request, 'origin') !== ownOrigin;
    done(isForeign ? new CsrfInvalidError() : undefined);
  });

  app.decorate('requireAuth', async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    const session = token ? await resolveSession(deps, token) : null;
    if (!session) {
      throw new UnauthenticatedError();
    }
    if (
      isUnsafe(request) &&
      !isSameSecret(readHeader(request, CSRF_HEADER_NAME), session.csrfToken)
    ) {
      throw new CsrfInvalidError();
    }
    const route = `${request.method} ${request.routeOptions.url ?? ''}`;
    if (session.user.mustChangePassword && !ROUTES_OPEN_DURING_PASSWORD_CHANGE.has(route)) {
      throw new PasswordChangeRequiredError();
    }
    request.authSession = session;
  });
}

export function requireSession(request: FastifyRequest): ResolvedSession {
  if (!request.authSession) {
    throw new UnauthenticatedError();
  }
  return request.authSession;
}
