import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertNotification, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';
import { markCorrectionNotificationsRead } from './notification-repository';

const NOW = new Date('2026-11-09T10:00:00Z');
const NOTIFICATION_LIST_LIMIT = 20;

interface ListBody {
  unreadCount: number;
  notifications: { id: number; readAt: string | null; payload: { workDate: string } }[];
}

describe('notifications', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let hugoId: number;

  function payload(workDate: string, correctionId = 1) {
    return { correctionId, ownerId: leaId, workDate, actorName: 'Sophie Dubois' };
  }

  async function sessionOf(email: string) {
    return logIn(app, email);
  }

  async function list(email: string) {
    const { cookie } = await sessionOf(email);
    return (
      await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie } })
    ).json<ListBody>();
  }

  async function patch(email: string, url: string, body: unknown = { isRead: true }) {
    const { cookie, csrfToken } = await sessionOf(email);
    return app.inject({
      method: 'PATCH',
      url,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: body as Record<string, unknown>,
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    leaId = await insertUser(db, { email: 'lea.notifications@example.com' });
    hugoId = await insertUser(db, { email: 'hugo.notifications@example.com' });
    for (let day = 1; day <= NOTIFICATION_LIST_LIMIT + 2; day += 1) {
      await insertNotification(db, {
        userId: leaId,
        type: 'clock_correction_received',
        payload: payload(`2026-10-${String(day).padStart(2, '0')}`),
      });
    }
    await insertNotification(db, {
      userId: hugoId,
      type: 'clock_correction_answered',
      payload: payload('2026-11-02'),
    });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists my latest 20 notifications, newest first, with my unread count', async () => {
    const body = await list('lea.notifications@example.com');

    expect(body.unreadCount).toBe(NOTIFICATION_LIST_LIMIT + 2);
    expect(body.notifications).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(body.notifications[0]?.payload.workDate).toBe('2026-10-22');
  });

  it('marks one of my notifications as read', async () => {
    const [first] = (await list('lea.notifications@example.com')).notifications;

    const response = await patch(
      'lea.notifications@example.com',
      `/api/v1/notifications/${first?.id}`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json<{ readAt: string }>().readAt).toBe(NOW.toISOString());
    expect((await list('lea.notifications@example.com')).unreadCount).toBe(
      NOTIFICATION_LIST_LIMIT + 1,
    );
  });

  it("answers 404 for someone else's notification", async () => {
    const [hugos] = (await list('hugo.notifications@example.com')).notifications;

    const response = await patch(
      'lea.notifications@example.com',
      `/api/v1/notifications/${hugos?.id}`,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('marks all my notifications as read without touching anyone else', async () => {
    const response = await patch('lea.notifications@example.com', '/api/v1/notifications');

    expect(response.statusCode).toBe(204);
    expect((await list('lea.notifications@example.com')).unreadCount).toBe(0);
    expect((await list('hugo.notifications@example.com')).unreadCount).toBe(1);
  });

  it('refuses to mark a notification as unread', async () => {
    const response = await patch('hugo.notifications@example.com', '/api/v1/notifications', {
      isRead: false,
    });

    expect(response.statusCode).toBe(400);
  });

  it('reads only the received notification of the given correction', async () => {
    const received = await insertNotification(db, {
      userId: hugoId,
      type: 'clock_correction_received',
      payload: payload('2026-11-03', 77),
    });
    const answered = await insertNotification(db, {
      userId: leaId,
      type: 'clock_correction_answered',
      payload: payload('2026-11-03', 77),
    });
    const other = await insertNotification(db, {
      userId: hugoId,
      type: 'clock_correction_received',
      payload: payload('2026-11-04', 78),
    });

    await markCorrectionNotificationsRead(db, { ownerId: hugoId, correctionId: 77, readAt: NOW });

    const rows = await db
      .selectFrom('notification')
      .select(['id', 'readAt'])
      .where('id', 'in', [received, answered, other])
      .execute();
    const readById = new Map(rows.map((row) => [row.id, row.readAt !== null]));
    expect(readById.get(received)).toBe(true);
    expect(readById.get(answered)).toBe(false);
    expect(readById.get(other)).toBe(false);
  });
});
