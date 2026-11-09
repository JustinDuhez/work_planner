import { markNotificationReadRequestSchema, truncateToMinute } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { requireSession } from '../auth/auth-plugin';
import type { Database } from '../db/database';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { NotificationNotFoundError } from './notification-errors';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-repository';

const notificationParamsSchema = z.object({ id: databaseIdSchema('Notification invalide.') });

export function registerNotificationRoutes(
  scope: FastifyInstance,
  deps: { db: Kysely<Database>; now: () => Date },
): void {
  scope.get('/api/v1/notifications', (request) =>
    listNotifications(deps.db, requireSession(request).user.id),
  );

  scope.patch('/api/v1/notifications/:id', async (request) => {
    const { id } = parseInput(notificationParamsSchema, request.params);
    parseInput(markNotificationReadRequestSchema, request.body);
    const notification = await markNotificationRead(deps.db, {
      userId: requireSession(request).user.id,
      notificationId: id,
      readAt: truncateToMinute(deps.now()),
    });
    if (!notification) throw new NotificationNotFoundError();
    return notification;
  });

  scope.patch('/api/v1/notifications', async (request, reply) => {
    parseInput(markNotificationReadRequestSchema, request.body);
    await markAllNotificationsRead(deps.db, {
      userId: requireSession(request).user.id,
      readAt: truncateToMinute(deps.now()),
    });
    return reply.status(204).send();
  });
}
