import { SESSION_IDLE_TIMEOUT_IN_MILLISECONDS } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { DEFAULT_TEST_PASSWORD, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock, type TestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const SESSION_MAX_AGE_IN_SECONDS = 604_800;
const LOGIN_ATTEMPTS_PER_IP_PER_MINUTE = 30;
const OVERLONG_EMAIL_LENGTH = 255;

describe('session routes', () => {
  let db: Kysely<Database>;
  let clock: TestClock;
  let app: FastifyInstance;
  let aliceId: number;
  let managerId: number;

  async function newApp(
    overrides: { isProduction?: boolean; trustedProxyHopCount?: number } = {},
  ): Promise<FastifyInstance> {
    const built = await buildApp({ config: createTestConfig(overrides), db, now: clock.now });
    built.post('/api/v1/test-protected-actions', { onRequest: built.requireAuth }, () => ({
      done: true,
    }));
    return built;
  }

  function postLogin(
    target: FastifyInstance,
    email: string,
    password: string,
    origin = TEST_ORIGIN,
  ) {
    return target.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: origin ? { origin } : {},
      payload: { email, password },
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    aliceId = await insertUser(db, {
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
    });
    managerId = await insertUser(db, {
      email: 'manager@example.com',
      firstName: 'Marc',
      lastName: 'Durand',
    });
    await insertUser(db, { email: 'blocked@example.com', isBlocked: true });
    await insertUser(db, { email: 'archived@example.com', isArchived: true });
    await insertTeam(db, { name: 'Front', managerId, memberIds: [aliceId] });
  });

  beforeEach(async () => {
    clock = createTestClock();
    app = await newApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('logs in and returns the current user with a CSRF token', async () => {
    const response = await postLogin(app, ' Alice@Example.com ', DEFAULT_TEST_PASSWORD);

    expect(response.statusCode).toBe(201);
    expect(response.json<unknown>()).toEqual({
      csrfToken: expect.any(String) as string,
      user: {
        id: aliceId,
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Martin',
        dailyMinutes: 420,
        roles: { isAdmin: false, isManager: false },
        teams: [{ id: expect.any(Number) as number, name: 'Front', isManager: false }],
        directManagers: [{ id: managerId, firstName: 'Marc', lastName: 'Durand' }],
      },
    });
  });

  it('sets an HttpOnly, SameSite=Lax session cookie for seven days', async () => {
    const response = await postLogin(app, 'alice@example.com', DEFAULT_TEST_PASSWORD);

    expect(response.cookies).toEqual([
      expect.objectContaining({
        name: 'wp_session',
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_IN_SECONDS,
      }),
    ]);
    expect(response.cookies[0]?.secure).toBeFalsy();
  });

  it('marks the session cookie Secure in production', async () => {
    const productionApp = await newApp({ isProduction: true });

    const response = await postLogin(productionApp, 'alice@example.com', DEFAULT_TEST_PASSWORD);

    expect(response.cookies[0]?.secure).toBe(true);
    await productionApp.close();
  });

  it.each([
    ['a wrong password', 'alice@example.com', 'wrong password!!'],
    ['an unknown email', 'nobody@example.com', DEFAULT_TEST_PASSWORD],
    ['an archived account', 'archived@example.com', DEFAULT_TEST_PASSWORD],
  ])('answers the same 401 for %s', async (_description, email, password) => {
    const response = await postLogin(app, email, password);

    expect(response.statusCode).toBe(401);
    expect(response.json<unknown>()).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou mot de passe incorrect.',
    });
    expect(response.cookies).toEqual([]);
  });

  it('answers 403 to a blocked user who typed the right password', async () => {
    const response = await postLogin(app, 'blocked@example.com', DEFAULT_TEST_PASSWORD);

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('ACCOUNT_BLOCKED');
  });

  it('reports invalid login fields', async () => {
    const response = await postLogin(app, 'not-an-email', '');

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Certains champs sont invalides.',
      fieldErrors: { email: 'Adresse email invalide.', password: 'Mot de passe requis.' },
    });
  });

  it('refuses an email longer than 254 characters', async () => {
    const overlongEmail = `${'a'.repeat(OVERLONG_EMAIL_LENGTH - '@example.com'.length)}@example.com`;

    const response = await postLogin(app, overlongEmail, DEFAULT_TEST_PASSWORD);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: unknown }>().fieldErrors).toEqual({
      email: 'Adresse email invalide.',
    });
  });

  it('locks an email after five failures, even if the sixth try is right', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLogin(app, 'alice@example.com', 'wrong password!!');
    }

    const response = await postLogin(app, 'alice@example.com', DEFAULT_TEST_PASSWORD);

    expect(response.statusCode).toBe(429);
    expect(response.json<{ code: string }>().code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('limits one address to thirty login attempts per minute', async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_IP_PER_MINUTE; attempt += 1) {
      await postLogin(app, `attempt${attempt}@example.com`, 'wrong password!!');
    }

    const response = await postLogin(app, 'alice@example.com', DEFAULT_TEST_PASSWORD);

    expect(response.statusCode).toBe(429);
    expect(response.json<{ code: string }>().code).toBe('TOO_MANY_ATTEMPTS');
  }, 30_000);

  it.each([
    ['without an Origin header', ''],
    ['from another site', 'https://evil.example'],
  ])('refuses a login request %s', async (_description, origin) => {
    const response = await postLogin(app, 'alice@example.com', DEFAULT_TEST_PASSWORD, origin);

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CSRF_INVALID');
  });

  it('answers 401 to /me without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('UNAUTHENTICATED');
  });

  it('restores the current user and CSRF token from the cookie', async () => {
    const { cookie, csrfToken } = await logIn(app, 'manager@example.com');

    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ csrfToken: string; user: { roles: unknown } }>()).toMatchObject({
      csrfToken,
      user: { roles: { isAdmin: false, isManager: true } },
    });
  });

  it('logs out: the old cookie no longer works', async () => {
    const { cookie, csrfToken } = await logIn(app, 'alice@example.com');

    const logout = await app.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/current',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
    });
    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(logout.statusCode).toBe(204);
    expect(logout.cookies).toEqual([expect.objectContaining({ name: 'wp_session', value: '' })]);
    expect(me.statusCode).toBe(401);
  });

  it('refuses a logout sent from another site and keeps the session', async () => {
    const { cookie, csrfToken } = await logIn(app, 'alice@example.com');

    const logout = await app.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/current',
      headers: { cookie, origin: 'https://evil.example', 'x-csrf-token': csrfToken },
    });
    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(logout.statusCode).toBe(403);
    expect(logout.json<{ code: string }>().code).toBe('CSRF_INVALID');
    expect(me.statusCode).toBe(200);
  });

  it('clears the cookie with the attributes it was set with', async () => {
    const productionApp = await newApp({ isProduction: true });

    const logout = await productionApp.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/current',
      headers: { origin: TEST_ORIGIN },
    });

    expect(logout.cookies).toEqual([
      expect.objectContaining({ httpOnly: true, sameSite: 'Lax', path: '/', secure: true }),
    ]);
    await productionApp.close();
  });

  it('accepts the https origin forwarded by the hosting proxy', async () => {
    const proxiedApp = await newApp({ isProduction: true, trustedProxyHopCount: 1 });

    const response = await proxiedApp.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { origin: 'https://localhost:80', 'x-forwarded-proto': 'https' },
      payload: { email: 'alice@example.com', password: DEFAULT_TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(201);
    await proxiedApp.close();
  });

  it.each([
    [0, '127.0.0.1'],
    [1, '198.51.100.7'],
  ])('with %i trusted proxies, reads the client address %s', async (hopCount, expectedIp) => {
    const proxiedApp = await newApp({ trustedProxyHopCount: hopCount });
    proxiedApp.get('/api/v1/test-ips', (request) => ({ ip: request.ip }));

    const response = await proxiedApp.inject({
      method: 'GET',
      url: '/api/v1/test-ips',
      headers: { 'x-forwarded-for': '203.0.113.66, 198.51.100.7' },
    });

    expect(response.json<{ ip: string }>().ip).toBe(expectedIp);
    await proxiedApp.close();
  });

  it('answers 204 to a logout without a session', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/current',
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.statusCode).toBe(204);
  });

  it('refuses a protected change without the CSRF token', async () => {
    const { cookie } = await logIn(app, 'alice@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-protected-actions',
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CSRF_INVALID');
  });

  it('refuses a protected change with a wrong CSRF token', async () => {
    const { cookie } = await logIn(app, 'alice@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-protected-actions',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': 'forged' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CSRF_INVALID');
  });

  it('accepts a protected change with the session CSRF token', async () => {
    const { cookie, csrfToken } = await logIn(app, 'alice@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-protected-actions',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
    });

    expect(response.statusCode).toBe(200);
  });

  it('asks the user to log in again after eight idle hours', async () => {
    const { cookie } = await logIn(app, 'alice@example.com');

    clock.advanceBy(SESSION_IDLE_TIMEOUT_IN_MILLISECONDS);
    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(response.statusCode).toBe(401);
  });

  it('ends the live session of a user blocked by an admin', async () => {
    const userId = await insertUser(db, { email: 'soon.blocked@example.com' });
    const { cookie } = await logIn(app, 'soon.blocked@example.com');

    await db.updateTable('appUser').set({ isBlocked: true }).where('id', '=', userId).execute();
    const response = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(response.statusCode).toBe(401);
  });
});
