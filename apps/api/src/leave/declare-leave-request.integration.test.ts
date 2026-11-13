import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertLeaveRequest, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 13 November 2026.
const NOW = new Date('2026-11-13T09:00:00Z');

describe('declaring an absence for someone', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let sophieId: number;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function declare(email: string, userId: number, payload: object) {
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method: 'POST',
      url: `/api/v1/users/${userId}/leave-requests`,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload,
    });
  }

  function sick(overrides: object = {}) {
    return {
      dayTypeCode: 'sick',
      startDate: '2026-11-03',
      startHalf: 'am',
      endDate: '2026-11-03',
      endHalf: 'pm',
      ...overrides,
    };
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    sophieId = await insertUser(db, {
      email: 'sophie.dec@example.com',
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    leaId = await insertUser(db, { email: 'lea.dec@example.com' });
    await insertUser(db, { email: 'hugo.dec@example.com' });
    await insertUser(db, { email: 'ines.dec@example.com', isAdmin: true });
    await insertTeam(db, { name: 'Front', managerId: sophieId, memberIds: [leaId] });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('records a past sick day approved at once, with the manager as author and decider', async () => {
    const response = await declare('sophie.dec@example.com', leaId, sick());

    expect(response.statusCode).toBe(201);
    expect(response.json<unknown>()).toMatchObject({
      status: 'approved',
      isAutoApproved: false,
      reviewer: { id: sophieId },
      declaredBy: { id: sophieId },
    });
    const told = await db
      .selectFrom('notification')
      .select(['userId', 'type'])
      .where('type', '=', 'leave_request_declared')
      .execute();
    expect(told).toEqual([{ userId: leaId, type: 'leave_request_declared' }]);
  });

  it('does not hold telework by the 3-day rule', async () => {
    const response = await declare(
      'sophie.dec@example.com',
      leaId,
      sick({ dayTypeCode: 'telework', startDate: '2026-11-16', endDate: '2026-11-19' }),
    );

    expect(response.json<unknown>()).toMatchObject({ status: 'approved', ruleNote: null });
  });

  it('lets an admin declare too', async () => {
    const response = await declare(
      'ines.dec@example.com',
      leaId,
      sick({ startDate: '2026-11-05', endDate: '2026-11-05' }),
    );

    expect(response.statusCode).toBe(201);
  });

  it('refuses an overlap', async () => {
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-09',
      status: 'pending',
    });

    const response = await declare(
      'sophie.dec@example.com',
      leaId,
      sick({ startDate: '2026-11-09', endDate: '2026-11-09' }),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_OVERLAP');
  });

  it('refuses to declare for yourself', async () => {
    const response = await declare('sophie.dec@example.com', sophieId, sick());

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_DECLARE_SELF');
  });

  it('refuses someone outside the scope', async () => {
    const response = await declare(
      'hugo.dec@example.com',
      leaId,
      sick({ startDate: '2026-11-06', endDate: '2026-11-06' }),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_DECLARE_FORBIDDEN');
  });

  it('answers 404 for an unknown person', async () => {
    const response = await declare('ines.dec@example.com', 999999, sick());

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('USER_NOT_FOUND');
  });
});
