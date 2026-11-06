import {
  changePasswordRequestSchema,
  findPasswordPolicyViolation,
  updateProfileRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse-input';
import { loadCurrentUser } from '../organization/current-user';
import {
  CurrentPasswordInvalidError,
  PasswordPolicyError,
  TooManyAttemptsError,
} from './auth-errors';
import { requireSession, SESSION_COOKIE_NAME } from './auth-plugin';
import { hashPassword, verifyPassword } from './password-hasher';
import { deleteOtherSessions, type AuthDependencies } from './session-service';
import { hashToken } from './session-token';

const PASSWORD_CHANGES_PER_WINDOW = 5;
const PASSWORD_CHANGE_WINDOW_IN_MILLISECONDS = 15 * 60_000;

export function registerMeRoutes(app: FastifyInstance, deps: AuthDependencies): void {
  app.patch('/api/v1/me', { onRequest: app.requireAuth }, async (request) => {
    const { user } = requireSession(request);
    const names = parseInput(updateProfileRequestSchema, request.body);
    await deps.db.updateTable('appUser').set(names).where('id', '=', user.id).execute();
    return loadCurrentUser(deps.db, user.id);
  });

  app.put(
    '/api/v1/me/password',
    {
      onRequest: app.requireAuth,
      config: {
        rateLimit: {
          max: PASSWORD_CHANGES_PER_WINDOW,
          timeWindow: PASSWORD_CHANGE_WINDOW_IN_MILLISECONDS,
          // The rate-limit hook runs before requireAuth, so the session is not resolved yet:
          // key on the session cookie (hashed, never stored raw) rather than on the shared IP.
          keyGenerator: (request) => hashToken(request.cookies[SESSION_COOKIE_NAME] ?? request.ip),
          errorResponseBuilder: () => new TooManyAttemptsError(),
        },
      },
    },
    async (request, reply) => {
      const session = requireSession(request);
      const { currentPassword, newPassword } = parseInput(
        changePasswordRequestSchema,
        request.body,
      );
      const { passwordHash } = await deps.db
        .selectFrom('appUser')
        .select('passwordHash')
        .where('id', '=', session.user.id)
        .executeTakeFirstOrThrow();
      if (!(await verifyPassword(passwordHash, currentPassword))) {
        throw new CurrentPasswordInvalidError();
      }
      const violation = findPasswordPolicyViolation(newPassword, currentPassword);
      if (violation) {
        throw new PasswordPolicyError(violation);
      }
      const newPasswordHash = await hashPassword(newPassword);
      // One transaction: a failure between the two steps must not leave other devices logged in
      // with the old password.
      await deps.db.transaction().execute(async (trx) => {
        await trx
          .updateTable('appUser')
          .set({ passwordHash: newPasswordHash })
          .where('id', '=', session.user.id)
          .execute();
        await deleteOtherSessions({ ...deps, db: trx }, session.user.id, session.sessionId);
      });
      return reply.status(204).send();
    },
  );
}
