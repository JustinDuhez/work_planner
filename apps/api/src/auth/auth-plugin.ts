import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CsrfInvalidError, UnauthenticatedError } from './auth-errors';
import { resolveSession, type AuthDependencies, type ResolvedSession } from './session-service';
import { isSameSecret } from './session-token';

export const SESSION_COOKIE_NAME = 'wp_session';
const CSRF_HEADER_NAME = 'x-csrf-token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
    request.authSession = session;
  });
}

export function requireSession(request: FastifyRequest): ResolvedSession {
  if (!request.authSession) {
    throw new UnauthenticatedError();
  }
  return request.authSession;
}
