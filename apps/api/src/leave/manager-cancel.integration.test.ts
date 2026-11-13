import type { LeaveRequestView, LeaveReviewInbox } from '@work-planner/domain';
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
const DEFAULT_DAY_MINUTES = 420;

interface WeekBody {
  counters: { globalGapMinutes: number };
}

describe('cancelling as a manager', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let sophieId: number;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function session(email: string) {
    const existing = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, existing);
    return existing;
  }

  async function cancel(email: string, requestId: number) {
    const { cookie, csrfToken } = await session(email);
    return app.inject({
      method: 'PUT',
      url: `/api/v1/leave-requests/${requestId}/cancellation`,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: {},
    });
  }

  async function get<T>(email: string, url: string): Promise<T> {
    const { cookie } = await session(email);
    return (await app.inject({ method: 'GET', url, headers: { cookie } })).json<T>();
  }

  async function globalGap(email: string, userId: number): Promise<number> {
    const week = await get<WeekBody>(email, `/api/v1/users/${userId}/clock-weeks/2026-W46`);
    return week.counters.globalGapMinutes;
  }

  async function cancelledById(requestId: number): Promise<number | null> {
    const row = await db
      .selectFrom('leaveRequest')
      .select('cancelledById')
      .where('id', '=', requestId)
      .executeTakeFirstOrThrow();
    return row.cancelledById;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const claireId = await insertUser(db, { email: 'claire.mc@example.com' });
    sophieId = await insertUser(db, {
      email: 'sophie.mc@example.com',
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    leaId = await insertUser(db, { email: 'lea.mc@example.com', startDate: '2026-10-19' });
    await insertUser(db, { email: 'hugo.mc@example.com' });
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

  it('lets a scope manager cancel a past approved leave, restores the balance and tells the person', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-10',
      status: 'approved',
      reviewerId: sophieId,
    });
    const withLeave = await globalGap('lea.mc@example.com', leaId);

    const response = await cancel('sophie.mc@example.com', requestId);

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toMatchObject({ status: 'cancelled' });
    expect(await globalGap('lea.mc@example.com', leaId)).toBe(withLeave - DEFAULT_DAY_MINUTES);
    expect(await cancelledById(requestId)).toBe(sophieId);
    const told = await db
      .selectFrom('notification')
      .select('userId')
      .where('type', '=', 'leave_request_withdrawn')
      .execute();
    expect(told.map((notification) => notification.userId)).toEqual([leaId]);
    // The owner-approved branch must not fire for a manager's cancel.
    const ownerNotices = await db
      .selectFrom('notification')
      .select('id')
      .where('type', '=', 'leave_request_cancelled')
      .execute();
    expect(ownerNotices).toEqual([]);
  });

  it('lets a higher-level manager cancel too, a pending request included', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'sick',
      startDate: '2026-11-04',
      status: 'pending',
    });

    expect((await cancel('claire.mc@example.com', requestId)).statusCode).toBe(200);
  });

  it('refuses a refused request with 409', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-25',
      status: 'refused',
    });

    const response = await cancel('sophie.mc@example.com', requestId);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_NOT_CANCELLABLE');
  });

  it('hides the request from someone outside the scope', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-26',
      status: 'pending',
    });

    expect((await cancel('hugo.mc@example.com', requestId)).statusCode).toBe(404);
  });

  it('records the owner as canceller on their own cancellation', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-27',
      status: 'pending',
    });

    await cancel('lea.mc@example.com', requestId);

    expect(await cancelledById(requestId)).toBe(leaId);
  });

  it('shows who declared a request, lets the manager cancel it from the inbox, and leaves self-made ones undeclared', async () => {
    const declaredId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'sick',
      startDate: '2026-11-30',
      status: 'approved',
      authorId: sophieId,
      reviewerId: sophieId,
    });
    const ownId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-12-01',
      status: 'pending',
    });
    await db
      .updateTable('leaveRequest')
      .set({ reviewedAt: NOW })
      .where('id', '=', declaredId)
      .execute();

    const inbox = await get<LeaveReviewInbox>(
      'sophie.mc@example.com',
      '/api/v1/leave-requests?view=to-review',
    );
    const mine = await get<LeaveRequestView[]>(
      'lea.mc@example.com',
      '/api/v1/leave-requests?view=mine',
    );

    const inInbox = inbox.recent.find((request) => request.id === declaredId);
    expect(inInbox?.canCancel).toBe(true);
    expect(mine.find((request) => request.id === declaredId)?.declaredBy?.id).toBe(sophieId);
    expect(mine.find((request) => request.id === ownId)?.declaredBy).toBeNull();
  });
});
