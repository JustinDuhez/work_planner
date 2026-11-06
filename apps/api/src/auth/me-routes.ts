import {
  changePasswordRequestSchema,
  findPasswordPolicyViolation,
  updateProfileRequestSchema,
} from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse-input';
import { loadCurrentUser } from '../organization/current-user';
import { CurrentPasswordInvalidError, PasswordPolicyError } from './auth-errors';
import { requireSession } from './auth-plugin';
import { hashPassword, verifyPassword } from './password-hasher';
import { deleteOtherSessions, type AuthDependencies } from './session-service';

export function registerMeRoutes(app: FastifyInstance, deps: AuthDependencies): void {
  app.patch('/api/v1/me', { onRequest: app.requireAuth }, async (request) => {
    const { user } = requireSession(request);
    const names = parseInput(updateProfileRequestSchema, request.body);
    await deps.db.updateTable('appUser').set(names).where('id', '=', user.id).execute();
    return loadCurrentUser(deps.db, user.id);
  });

  app.put('/api/v1/me/password', { onRequest: app.requireAuth }, async (request, reply) => {
    const session = requireSession(request);
    const { currentPassword, newPassword } = parseInput(changePasswordRequestSchema, request.body);
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
    await deps.db
      .updateTable('appUser')
      .set({ passwordHash: await hashPassword(newPassword) })
      .where('id', '=', session.user.id)
      .execute();
    // A changed password must log out every other device that may hold the old one.
    await deleteOtherSessions(deps, session.user.id, session.sessionId);
    return reply.status(204).send();
  });
}
