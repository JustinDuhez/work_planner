import type { NotificationPayload, NotificationType } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { insertNotification } from './notification-repository';

/**
 * The single entry point for sending an in-app notification (E5-D6). E6 reuses it for leave
 * requests; a real-time channel (S1) would be added here without changing any caller.
 */
export function notify(
  db: Kysely<Database>,
  notification: { userId: number; type: NotificationType; payload: NotificationPayload },
): Promise<void> {
  return insertNotification(db, notification);
}
