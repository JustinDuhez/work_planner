import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertLeaveRequest, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-12T08:00:00Z');

describe('reviewing leave requests', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let sophieId: number;
  let nextWeekday = 0;
  // One fresh, non-overlapping weekday per test request.
  const WEEKDAYS = [
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-30',
    '2026-12-01',
    '2026-12-02',
    '2026-12-03',
    '2026-12-04',
  ];
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function review(email: string, requestId: number, payload: object) {
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method: 'PUT',
      url: `/api/v1/leave-requests/${requestId}/review`,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload,
    });
  }

  async function pendingLeave(): Promise<number> {
    const startDate = WEEKDAYS[nextWeekday];
    nextWeekday += 1;
    if (startDate === undefined) throw new Error('Add more weekdays to WEEKDAYS');
    return insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate,
      status: 'pending',
    });
  }

  async function halfDayCount(requestId: number): Promise<number> {
    const rows = await db
      .selectFrom('halfDay')
      .select('id')
      .where('leaveRequestId', '=', requestId)
      .execute();
    return rows.length;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const claireId = await insertUser(db, { email: 'claire.rev@example.com' });
    sophieId = await insertUser(db, {
      email: 'sophie.rev@example.com',
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    leaId = await insertUser(db, { email: 'lea.rev@example.com' });
    await insertUser(db, { email: 'ines.rev@example.com', isAdmin: true });
    await insertUser(db, { email: 'hugo.rev@example.com' });
    const techId = await insertTeam(db, { name: 'Tech', managerId: claireId });
    await insertTeam(db, {
      name: 'Front',
      parentTeamId: techId,
      managerId: sophieId,
      memberIds: [leaId],
    });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lets the direct manager approve, keeps the half-days and tells the requester', async () => {
    const requestId = await pendingLeave();

    const response = await review('sophie.rev@example.com', requestId, { decision: 'approved' });

    expect(response.json<unknown>()).toMatchObject({
      status: 'approved',
      reviewer: { id: sophieId },
      canReview: false,
    });
    expect(await halfDayCount(requestId)).toBe(2);
    const told = await db
      .selectFrom('notification')
      .select(['userId', 'payload'])
      .where('type', '=', 'leave_request_reviewed')
      .execute();
    expect(told.map((row) => row.userId)).toContain(leaId);
  });

  it('lets an admin refuse with a comment and frees the half-days', async () => {
    const requestId = await pendingLeave();

    const response = await review('ines.rev@example.com', requestId, {
      decision: 'refused',
      comment: 'Période chargée',
    });

    expect(response.json<unknown>()).toMatchObject({
      status: 'refused',
      reviewComment: 'Période chargée',
    });
    expect(await halfDayCount(requestId)).toBe(0);
  });

  it('needs a comment to refuse', async () => {
    const requestId = await pendingLeave();

    const response = await review('sophie.rev@example.com', requestId, {
      decision: 'refused',
      comment: '  ',
    });

    expect(response.json<{ code: string; fieldErrors: Record<string, string> }>()).toMatchObject({
      code: 'LEAVE_COMMENT_REQUIRED',
      fieldErrors: { comment: 'Indiquez la raison du refus.' },
    });
  });

  it.each([
    ['the requester', 'lea.rev@example.com', 403, 'LEAVE_REVIEW_FORBIDDEN'],
    ['a higher-level manager', 'claire.rev@example.com', 403, 'LEAVE_REVIEW_FORBIDDEN'],
    ['someone outside the scope', 'hugo.rev@example.com', 404, 'LEAVE_NOT_FOUND'],
  ])('refuses %s', async (_who, email, status, code) => {
    const requestId = await pendingLeave();

    const response = await review(email, requestId, { decision: 'approved' });

    expect(response.statusCode).toBe(status);
    expect(response.json<{ code: string }>().code).toBe(code);
  });

  it('refuses to decide twice and lets only one of two simultaneous decisions win', async () => {
    const requestId = await pendingLeave();

    const responses = await Promise.all([
      review('sophie.rev@example.com', requestId, { decision: 'approved' }),
      review('ines.rev@example.com', requestId, { decision: 'refused', comment: 'Non' }),
    ]);
    const again = await review('sophie.rev@example.com', requestId, { decision: 'approved' });

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(again.json<{ code: string }>().code).toBe('LEAVE_NOT_PENDING');
  });

  it("marks the approvers' notifications of the request as read once decided", async () => {
    const requestId = await pendingLeave();
    await db
      .insertInto('notification')
      .values({
        userId: sophieId,
        type: 'leave_request_received',
        payload: JSON.stringify({
          leaveRequestId: requestId,
          actorName: 'Léa',
          dayTypeLabel: 'Congé',
          startDate: '2026-11-24',
          endDate: '2026-11-24',
        }),
      })
      .execute();

    const otherId = await pendingLeave();
    await db
      .insertInto('notification')
      .values({
        userId: sophieId,
        type: 'leave_request_received',
        payload: JSON.stringify({
          leaveRequestId: otherId,
          actorName: 'Léa',
          dayTypeLabel: 'Congé',
          startDate: '2026-11-25',
          endDate: '2026-11-25',
        }),
      })
      .execute();

    await review('ines.rev@example.com', requestId, { decision: 'approved' });

    const unread = await db
      .selectFrom('notification')
      .select('payload')
      .where('userId', '=', sophieId)
      .where('readAt', 'is', null)
      .where('type', '=', 'leave_request_received')
      .execute();
    // Only the decided request is read: another request's notification stays unread.
    expect(
      unread.map((row) => ('leaveRequestId' in row.payload ? row.payload.leaveRequestId : null)),
    ).toEqual([otherId]);
  });
});
