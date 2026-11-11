import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

describe('settings', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  async function patch(email: string, payload: object) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload,
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: 'ines.set@example.com', isAdmin: true });
    await insertUser(db, { email: 'lea.set@example.com' });
    const managerId = await insertUser(db, { email: 'marc.set@example.com' });
    await insertTeam(db, { name: 'Settings team', managerId });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock().now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('starts with the year starting on 1 July, readable by everyone', async () => {
    const { cookie } = await logIn(app, 'lea.set@example.com');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie },
    });

    expect(response.json<unknown>()).toEqual({ yearStart: '07-01' });
  });

  it('lets an admin move the year start', async () => {
    const response = await patch('ines.set@example.com', { yearStart: '09-01' });

    expect(response.json<unknown>()).toEqual({ yearStart: '09-01' });
  });

  it('refuses a day that does not exist every year', async () => {
    const response = await patch('ines.set@example.com', { yearStart: '02-29' });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.yearStart).toBe(
      'Choisissez un jour qui existe chaque année.',
    );
  });

  it.each(['lea.set@example.com', 'marc.set@example.com'])(
    'refuses non-admin %s',
    async (email) => {
      const response = await patch(email, { yearStart: '01-01' });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('SETTINGS_FORBIDDEN');
    },
  );
});
