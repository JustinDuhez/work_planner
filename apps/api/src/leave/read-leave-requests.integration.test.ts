import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertLeaveRequest, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-12T08:00:00Z');

interface View {
  id: number;
  user: { firstName: string };
  status: string;
  canReview: boolean;
  canCancel: boolean;
}

describe('reading leave requests', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let sophieId: number;

  async function get(email: string, view: string) {
    const { cookie } = await logIn(app, email);
    return app.inject({
      method: 'GET',
      url: `/api/v1/leave-requests?view=${view}`,
      headers: { cookie },
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    // Claire manages Tech; Sophie manages Front (child of Tech) with Léa in it.
    const claireId = await insertUser(db, {
      email: 'claire.read@example.com',
      firstName: 'Claire',
    });
    sophieId = await insertUser(db, { email: 'sophie.read@example.com', firstName: 'Sophie' });
    leaId = await insertUser(db, { email: 'lea.read@example.com', firstName: 'Léa' });
    await insertUser(db, { email: 'hugo.read@example.com', firstName: 'Hugo' });
    await insertUser(db, { email: 'ines.read@example.com', firstName: 'Inès', isAdmin: true });
    const techId = await insertTeam(db, { name: 'Tech', managerId: claireId });
    await insertTeam(db, {
      name: 'Front',
      parentTeamId: techId,
      managerId: sophieId,
      memberIds: [leaId],
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      status: 'pending',
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'sick',
      startDate: '2026-11-16',
      status: 'approved',
      reviewerId: sophieId,
    });
    await db
      .updateTable('leaveRequest')
      .set({ reviewedAt: new Date('2026-11-10T09:00:00Z') })
      .where('status', '=', 'approved')
      .execute();
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists my own requests, newest first, with what I may do', async () => {
    const mine = (await get('lea.read@example.com', 'mine')).json<View[]>();

    expect(mine.map((request) => request.status)).toEqual(['approved', 'pending']);
    expect(mine.every((request) => !request.canReview)).toBe(true);
    expect(mine.map((request) => request.canCancel)).toEqual([true, true]);
  });

  it('gives the direct manager the pending request to decide and the recent decisions', async () => {
    const inbox = (await get('sophie.read@example.com', 'to-review')).json<{
      pending: View[];
      recent: View[];
    }>();

    expect(inbox.pending).toHaveLength(1);
    expect(inbox.pending[0]).toMatchObject({ user: { firstName: 'Léa' }, canReview: true });
    expect(inbox.recent.map((request) => request.status)).toEqual(['approved']);
  });

  it('shows a higher-level manager the request without the right to decide', async () => {
    const inbox = (await get('claire.read@example.com', 'to-review')).json<{ pending: View[] }>();

    expect(inbox.pending[0]?.canReview).toBe(false);
  });

  it('gives an admin every pending request to decide', async () => {
    const inbox = (await get('ines.read@example.com', 'to-review')).json<{ pending: View[] }>();

    expect(inbox.pending[0]?.canReview).toBe(true);
  });

  it('leaves the requests of archived people out of an admin inbox', async () => {
    const goneId = await insertUser(db, {
      email: 'gone.read@example.com',
      firstName: 'Gabin',
      isArchived: true,
    });
    await insertLeaveRequest(db, {
      userId: goneId,
      dayTypeCode: 'leave',
      startDate: '2026-11-24',
      status: 'pending',
    });

    const inbox = (await get('ines.read@example.com', 'to-review')).json<{ pending: View[] }>();

    expect(inbox.pending.map((request) => request.user.firstName)).toEqual(['Léa']);
  });

  it('refuses the inbox to a collaborator', async () => {
    const response = await get('hugo.read@example.com', 'to-review');

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('LEAVE_REVIEW_FORBIDDEN');
  });

  it('refuses an unknown view', async () => {
    expect((await get('lea.read@example.com', 'everything')).statusCode).toBe(400);
  });
});
