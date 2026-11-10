import {
  loginRequestSchema,
  SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse-input';
import { loadCurrentUser } from '../organization/current-user';
import { TooManyAttemptsError } from './auth-errors';
import { SESSION_COOKIE_NAME } from './auth-plugin';
import { authenticate } from './authenticate';
import type { LoginFailureLimiter } from './login-failure-limiter';
import {
  createSession,
  deleteSession,
  purgeExpiredSessions,
  type AuthDependencies,
} from './session-service';

const MILLISECONDS_PER_SECOND = 1000;
const LOGIN_ATTEMPTS_PER_IP_PER_MINUTE = 30;
const ONE_MINUTE_IN_MILLISECONDS = 60_000;

export interface SessionRouteDependencies extends AuthDependencies {
  isProduction: boolean;
  loginFailureLimiter: LoginFailureLimiter;
}

// Clearing a cookie only works when its attributes match those it was set with.
function sessionCookieAttributes(isProduction: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction };
}

export function registerSessionRoutes(app: FastifyInstance, deps: SessionRouteDependencies): void {
  app.post(
    '/api/v1/sessions',
    {
      config: {
        rateLimit: {
          max: LOGIN_ATTEMPTS_PER_IP_PER_MINUTE,
          timeWindow: ONE_MINUTE_IN_MILLISECONDS,
          errorResponseBuilder: () => new TooManyAttemptsError(),
        },
      },
    },
    async (request, reply) => {
      const credentials = parseInput(loginRequestSchema, request.body);
      const attemptKey = `${request.ip}|${credentials.email}`;
      if (deps.loginFailureLimiter.isLocked(attemptKey)) {
        throw new TooManyAttemptsError();
      }
      // Counted before the ~50 ms password check, so parallel requests cannot all slip
      // through the lock while their passwords are being verified.
      deps.loginFailureLimiter.recordAttempt(attemptKey);
      const userId = await authenticate(deps.db, credentials);
      deps.loginFailureLimiter.clear(attemptKey);
      await purgeExpiredSessions(deps);
      const { token, csrfToken } = await createSession(deps, userId);
      reply.setCookie(SESSION_COOKIE_NAME, token, {
        ...sessionCookieAttributes(deps.isProduction),
        maxAge: SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS / MILLISECONDS_PER_SECOND,
      });
      return reply.status(201).send({ user: await loadCurrentUser(deps.db, userId), csrfToken });
    },
  );

  // Not behind requireAuth: an expired session must still be able to clear its cookie.
  app.delete('/api/v1/sessions/current', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await deleteSession(deps, token);
    }
    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieAttributes(deps.isProduction));
    return reply.status(204).send();
  });
}
