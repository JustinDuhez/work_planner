import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertPublicHoliday, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const ADMIN = 'ines.hol@example.com';
const COLLEAGUE = 'lea.hol@example.com';
const MANAGER = 'marc.hol@example.com';

describe('public holidays', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function request(
    email: string,
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method,
      url,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      ...(payload ? { payload } : {}),
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: ADMIN, isAdmin: true });
    await insertUser(db, { email: COLLEAGUE });
    const managerId = await insertUser(db, { email: MANAGER });
    await insertTeam(db, { name: 'Holiday team', managerId });
    await insertPublicHoliday(db, { date: '2025-12-25', label: 'Noël' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock().now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lets everyone read the holidays of a year, in date order', async () => {
    await insertPublicHoliday(db, { date: '2030-05-01', label: 'Fête du Travail' });
    await insertPublicHoliday(db, { date: '2030-01-01', label: "Jour de l'an" });

    const response = await request(COLLEAGUE, 'GET', '/api/v1/public-holidays?year=2030');

    expect(response.json<unknown>()).toEqual([
      { date: '2030-01-01', label: "Jour de l'an" },
      { date: '2030-05-01', label: 'Fête du Travail' },
    ]);
  });

  it('refuses a year out of range', async () => {
    expect((await request(COLLEAGUE, 'GET', '/api/v1/public-holidays?year=1999')).statusCode).toBe(
      400,
    );
  });

  it.each([
    ['missing', '/api/v1/public-holidays'],
    ['not a number', '/api/v1/public-holidays?year=abc'],
  ])('refuses a %s year with a French message', async (_name, url) => {
    const response = await request(COLLEAGUE, 'GET', url);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.year).toBe(
      'Choisissez une année entre 2000 et 2100.',
    );
  });

  it('imports the French holidays once, then adds nothing', async () => {
    const first = await request(ADMIN, 'POST', '/api/v1/public-holiday-imports', { year: 2026 });
    const second = await request(ADMIN, 'POST', '/api/v1/public-holiday-imports', { year: 2026 });

    expect(first.statusCode).toBe(201);
    expect(first.json<unknown>()).toEqual({ addedCount: 11 });
    expect(second.json<unknown>()).toEqual({ addedCount: 0 });
  });

  it('adds and deletes a holiday', async () => {
    const added = await request(ADMIN, 'POST', '/api/v1/public-holidays', {
      date: '2031-12-24',
      label: ' Pont ',
    });
    const deleted = await request(ADMIN, 'DELETE', '/api/v1/public-holidays/2031-12-24');
    const deletedAgain = await request(ADMIN, 'DELETE', '/api/v1/public-holidays/2031-12-24');

    expect(added.statusCode).toBe(201);
    expect(added.json<unknown>()).toEqual({ date: '2031-12-24', label: 'Pont' });
    expect(deleted.statusCode).toBe(204);
    expect(deletedAgain.statusCode).toBe(404);
    expect(deletedAgain.json<{ code: string }>().code).toBe('HOLIDAY_NOT_FOUND');
  });

  it('refuses a second holiday on the same date', async () => {
    const response = await request(ADMIN, 'POST', '/api/v1/public-holidays', {
      date: '2025-12-25',
      label: 'Doublon',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('HOLIDAY_EXISTS');
  });

  it('refuses a date that does not exist', async () => {
    const response = await request(ADMIN, 'POST', '/api/v1/public-holidays', {
      date: '2026-02-30',
      label: 'X',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.date).toBe(
      'Date invalide.',
    );
  });

  it('refuses to delete a date that does not exist', async () => {
    const response = await request(ADMIN, 'DELETE', '/api/v1/public-holidays/2026-02-30');

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: Record<string, string> }>().fieldErrors).toHaveProperty(
      'date',
    );
  });

  it.each([COLLEAGUE, MANAGER])('refuses every write to non-admin %s', async (email) => {
    const responses = [
      await request(email, 'POST', '/api/v1/public-holidays', {
        date: '2032-01-02',
        label: 'X',
      }),
      await request(email, 'DELETE', '/api/v1/public-holidays/2025-12-25'),
      await request(email, 'POST', '/api/v1/public-holiday-imports', { year: 2032 }),
    ];

    expect(responses.map((response) => response.statusCode)).toEqual([403, 403, 403]);
    expect(responses[0]?.json<{ code: string }>().code).toBe('HOLIDAY_MANAGEMENT_FORBIDDEN');
  });
});
