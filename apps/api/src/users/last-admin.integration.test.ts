import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

describe('the last active admin', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let firstId: number;
  let secondId: number;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    firstId = await insertUser(db, { email: 'first.admin@example.com', isAdmin: true });
    secondId = await insertUser(db, { email: 'second.admin@example.com', isAdmin: true });
    app = await buildApp({
      config: createTestConfig(),
      db,
      now: createTestClock(new Date('2026-11-10T09:00:00Z')).now,
    });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('is never lost when two admins demote each other at once', async () => {
    const [first, second] = await Promise.all([
      logIn(app, 'first.admin@example.com'),
      logIn(app, 'second.admin@example.com'),
    ]);
    const demote = (session: { cookie: string; csrfToken: string }, targetId: number) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${targetId}`,
        headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
        payload: { isAdmin: false },
      });

    const responses = await Promise.all([demote(first, secondId), demote(second, firstId)]);
    const admins = await db
      .selectFrom('appUser')
      .select('id')
      .where('isAdmin', '=', true)
      .execute();

    // The later one is refused: 409 when both passed authentication, 401 when the first
    // demotion had already ended the second admin's sessions.
    expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(admins).toHaveLength(1);
  });
});
