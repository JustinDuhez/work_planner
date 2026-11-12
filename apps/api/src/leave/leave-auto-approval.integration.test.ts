import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

describe('a request nobody can approve', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: 'lone.admin@example.com', isAdmin: true });
    // A blocked admin cannot log in, so it does not count as someone who can approve.
    await insertUser(db, { email: 'blocked.admin@example.com', isAdmin: true, isBlocked: true });
    app = await buildApp({
      config: createTestConfig(),
      db,
      now: createTestClock(new Date('2026-11-12T08:00:00Z')).now,
    });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('is approved at once and marked so', async () => {
    const { cookie, csrfToken } = await logIn(app, 'lone.admin@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/leave-requests',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: {
        dayTypeCode: 'leave',
        startDate: '2026-11-23',
        startHalf: 'am',
        endDate: '2026-11-23',
        endHalf: 'pm',
      },
    });

    expect(response.json<unknown>()).toMatchObject({ status: 'approved', isAutoApproved: true });
    expect(await db.selectFrom('notification').select('id').execute()).toEqual([]);
  });
});
