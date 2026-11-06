import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { DEFAULT_TEST_PASSWORD, insertUser } from '../test/fixtures';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NEW_PASSWORD = 'a brand new passphrase';

describe('my profile routes', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let userCount = 0;

  async function newLoggedInUser() {
    userCount += 1;
    const email = `profile.user${userCount}@example.com`;
    await insertUser(db, { email, firstName: 'Old', lastName: 'Name' });
    return { email, ...(await logIn(app, email)) };
  }

  function send(
    method: 'PATCH' | 'PUT',
    url: string,
    session: { cookie: string; csrfToken: string },
    payload: unknown,
  ) {
    return app.inject({
      method,
      url,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload: payload as Record<string, unknown>,
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  beforeEach(async () => {
    app = await buildApp({ config: createTestConfig(), db });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('updates the first and last name, trimmed', async () => {
    const session = await newLoggedInUser();

    const response = await send('PATCH', '/api/v1/me', session, {
      firstName: '  Alice ',
      lastName: ' Martin  ',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toMatchObject({ firstName: 'Alice', lastName: 'Martin' });
  });

  it('refuses an empty first name with a field message', async () => {
    const session = await newLoggedInUser();

    const response = await send('PATCH', '/api/v1/me', session, { firstName: ' ', lastName: 'X' });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: unknown }>().fieldErrors).toEqual({
      firstName: 'Prénom requis.',
    });
  });

  it('refuses any field other than the names, such as the email', async () => {
    const session = await newLoggedInUser();

    const response = await send('PATCH', '/api/v1/me', session, {
      firstName: 'A',
      lastName: 'B',
      email: 'takeover@example.com',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('VALIDATION_ERROR');
    const stored = await db
      .selectFrom('appUser')
      .select('email')
      .where('email', '=', session.email)
      .executeTakeFirst();
    expect(stored).toBeDefined();
  });

  it('refuses a profile change without the CSRF token', async () => {
    const session = await newLoggedInUser();

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { cookie: session.cookie, origin: TEST_ORIGIN },
      payload: { firstName: 'A', lastName: 'B' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a password change when the current password is wrong', async () => {
    const session = await newLoggedInUser();

    const response = await send('PUT', '/api/v1/me/password', session, {
      currentPassword: 'not my password',
      newPassword: NEW_PASSWORD,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({
      code: 'CURRENT_PASSWORD_INVALID',
      fieldErrors: { currentPassword: 'Le mot de passe actuel est incorrect.' },
    });
  });

  it('throttles current-password guesses on the sixth attempt of a session', async () => {
    const session = await newLoggedInUser();
    const guess = { currentPassword: 'not my password', newPassword: NEW_PASSWORD };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await send('PUT', '/api/v1/me/password', session, guess)).statusCode).toBe(400);
    }
    const response = await send('PUT', '/api/v1/me/password', session, guess);

    expect(response.statusCode).toBe(429);
    expect(response.json<{ code: string }>().code).toBe('TOO_MANY_ATTEMPTS');
  });

  it.each([
    ['too short', 'short pass', 'Le mot de passe doit contenir au moins 12 caractères.'],
    [
      'the same as the current one',
      DEFAULT_TEST_PASSWORD,
      "Le nouveau mot de passe doit être différent de l'actuel.",
    ],
  ])('refuses a new password that is %s', async (_description, newPassword, message) => {
    const session = await newLoggedInUser();

    const response = await send('PUT', '/api/v1/me/password', session, {
      currentPassword: DEFAULT_TEST_PASSWORD,
      newPassword,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({
      code: 'PASSWORD_POLICY',
      fieldErrors: { newPassword: message },
    });
  });

  it('changes the password, keeps this session and ends the other ones', async () => {
    const session = await newLoggedInUser();
    const otherDevice = await logIn(app, session.email);

    const response = await send('PUT', '/api/v1/me/password', session, {
      currentPassword: DEFAULT_TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    const meHere = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: session.cookie },
    });
    const meElsewhere = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: otherDevice.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(meHere.statusCode).toBe(200);
    expect(meElsewhere.statusCode).toBe(401);
    await expect(logIn(app, session.email, NEW_PASSWORD)).resolves.toHaveProperty('cookie');
    await expect(logIn(app, session.email, DEFAULT_TEST_PASSWORD)).rejects.toThrow(/401/);
  });
});
