import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertLeaveRequest, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Thursday 12 November 2026.
const NOW = new Date('2026-11-12T08:00:00Z');

describe('cancelling leave requests', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let sophieId: number;

  async function cancel(email: string, requestId: number) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method: 'PUT',
      url: `/api/v1/leave-requests/${requestId}/cancellation`,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: {},
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    sophieId = await insertUser(db, { email: 'sophie.cancel@example.com' });
    leaId = await insertUser(db, {
      email: 'lea.cancel@example.com',
      firstName: 'Léa',
      lastName: 'Moreau',
    });
    await insertTeam(db, { name: 'Front', managerId: sophieId, memberIds: [leaId] });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('cancels a pending request and frees its half-days', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      status: 'pending',
    });

    const response = await cancel('lea.cancel@example.com', requestId);

    expect(response.json<unknown>()).toMatchObject({ status: 'cancelled', canCancel: false });
    expect(
      await db.selectFrom('halfDay').select('id').where('leaveRequestId', '=', requestId).execute(),
    ).toEqual([]);
  });

  it('cancels an approved request that has not started and tells the approvers', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-24',
      status: 'approved',
      reviewerId: sophieId,
    });

    const response = await cancel('lea.cancel@example.com', requestId);

    expect(response.statusCode).toBe(200);
    const told = await db
      .selectFrom('notification')
      .select('userId')
      .where('type', '=', 'leave_request_cancelled')
      .execute();
    expect(told.map((row) => row.userId)).toContain(sophieId);
  });

  it.each([
    ['an approved request starting today', { status: 'approved', startDate: '2026-11-12' }],
    ['a refused request', { status: 'refused', startDate: '2026-11-25' }],
  ] as const)('refuses to cancel %s', async (_what, request) => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      ...request,
    });

    const response = await cancel('lea.cancel@example.com', requestId);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_NOT_CANCELLABLE');
  });

  it('lets only the owner cancel', async () => {
    const requestId = await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-26',
      status: 'pending',
    });

    const response = await cancel('sophie.cancel@example.com', requestId);

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_NOT_FOUND');
  });
});
