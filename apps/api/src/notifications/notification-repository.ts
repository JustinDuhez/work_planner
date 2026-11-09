import type {
  NotificationList,
  NotificationPayload,
  NotificationType,
  NotificationView,
} from '@work-planner/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/database';

const NOTIFICATION_LIST_LIMIT = 20;

interface StoredNotification {
  id: number;
  type: NotificationType;
  payload: NotificationPayload;
  readAt: Date | null;
  createdAt: Date;
}

function toNotificationView(notification: StoredNotification): NotificationView {
  return {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function insertNotification(
  db: Kysely<Database>,
  notification: { userId: number; type: NotificationType; payload: NotificationPayload },
): Promise<void> {
  await db
    .insertInto('notification')
    .values({ ...notification, payload: JSON.stringify(notification.payload) })
    .execute();
}

export async function listNotifications(
  db: Kysely<Database>,
  userId: number,
): Promise<NotificationList> {
  const [rows, { unreadCount }] = await Promise.all([
    db
      .selectFrom('notification')
      .select(['id', 'type', 'payload', 'readAt', 'createdAt'])
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(NOTIFICATION_LIST_LIMIT)
      .execute(),
    db
      .selectFrom('notification')
      .select((eb) => eb.fn.countAll<string>().as('unreadCount'))
      .where('userId', '=', userId)
      .where('readAt', 'is', null)
      .executeTakeFirstOrThrow(),
  ]);
  return { unreadCount: Number(unreadCount), notifications: rows.map(toNotificationView) };
}

export async function markNotificationRead(
  db: Kysely<Database>,
  query: { userId: number; notificationId: number; readAt: Date },
): Promise<NotificationView | undefined> {
  const row = await db
    .updateTable('notification')
    // An already-read notification keeps its first read time.
    .set({ readAt: sql<Date>`COALESCE(read_at, ${query.readAt})` })
    .where('id', '=', query.notificationId)
    .where('userId', '=', query.userId)
    .returning(['id', 'type', 'payload', 'readAt', 'createdAt'])
    .executeTakeFirst();
  return row && toNotificationView(row);
}

export async function markAllNotificationsRead(
  db: Kysely<Database>,
  query: { userId: number; readAt: Date },
): Promise<void> {
  await db
    .updateTable('notification')
    .set({ readAt: query.readAt })
    .where('userId', '=', query.userId)
    .where('readAt', 'is', null)
    .execute();
}

/** A superseded correction can no longer be answered: its "received" notification is done. */
export async function markCorrectionNotificationsRead(
  db: Kysely<Database>,
  correctionId: number,
  readAt: Date,
): Promise<void> {
  await db
    .updateTable('notification')
    .set({ readAt })
    .where('type', '=', 'clock_correction_received')
    .where(sql<boolean>`(payload ->> 'correctionId')::int = ${correctionId}`)
    .where('readAt', 'is', null)
    .execute();
}
