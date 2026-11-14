import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-13T09:00:00Z');

describe('resetting several counters', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let sophieId: number;
  let leaId: number;
  let tomId: number;
  let hugoId: number;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function resetMany(email: string, payload: object) {
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method: 'POST',
      url: '/api/v1/counter-resets',
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload,
    });
  }

  async function resetCount(): Promise<number> {
    const rows = await db.selectFrom('counterReset').select('id').execute();
    return rows.length;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    sophieId = await insertUser(db, { email: 'sophie.rb@example.com' });
    leaId = await insertUser(db, { email: 'lea.rb@example.com', startDate: '2026-10-19' });
    tomId = await insertUser(db, { email: 'tom.rb@example.com', startDate: '2026-11-10' });
    hugoId = await insertUser(db, {
      email: 'hugo.rb@example.com',
      firstName: 'Hugo',
      lastName: 'Laurent',
    });
    await insertUser(db, { email: 'ines.rb@example.com', isAdmin: true });
    await insertTeam(db, { name: 'Front', managerId: sophieId, memberIds: [leaId, tomId] });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('resets every chosen person of the scope, the manager included, at once', async () => {
    const response = await resetMany('sophie.rb@example.com', {
      userIds: [sophieId, leaId],
      resetDate: '2026-11-02',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ resets: { resetDate: string }[] }>().resets).toHaveLength(2);
    const rows = await db
      .selectFrom('counterReset')
      .select(['userId', 'authorId'])
      .where('resetDate', '=', '2026-11-02')
      .execute();
    expect(rows.map((row) => row.userId).sort((a, b) => a - b)).toEqual(
      [sophieId, leaId].sort((a, b) => a - b),
    );
    expect(rows.every((row) => row.authorId === sophieId)).toBe(true);
  });

  it('resets nobody when one person is outside the scope, and names them', async () => {
    const before = await resetCount();

    const response = await resetMany('sophie.rb@example.com', { userIds: [leaId, hugoId] });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string; message: string }>()).toEqual({
      code: 'COUNTER_RESET_FORBIDDEN',
      message: 'Vous ne pouvez pas remettre ce compteur à zéro. (Hugo Laurent)',
    });
    expect(await resetCount()).toBe(before);
  });

  it('refuses a date before one person’s start and names them', async () => {
    const response = await resetMany('ines.rb@example.com', {
      userIds: [leaId, tomId],
      resetDate: '2026-11-03',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string; message: string }>().code).toBe(
      'COUNTER_RESET_DATE_BEFORE_START',
    );
    expect(response.json<{ message: string }>().message).toMatch(/\(.+\)$/);
  });

  it('refuses a future date', async () => {
    const response = await resetMany('ines.rb@example.com', {
      userIds: [leaId],
      resetDate: '2026-11-14',
    });

    expect(response.json<{ code: string }>().code).toBe('COUNTER_RESET_DATE_IN_FUTURE');
  });

  it.each([[{ userIds: [] }], [{ userIds: [3, 3] }]])('refuses %j with 400', async (payload) => {
    expect((await resetMany('ines.rb@example.com', payload)).statusCode).toBe(400);
  });

  it('answers 404 for an unknown person', async () => {
    const response = await resetMany('ines.rb@example.com', { userIds: [leaId, 999999] });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('USER_NOT_FOUND');
  });
});
