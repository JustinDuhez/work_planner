import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { DEFAULT_TEST_PASSWORD, insertUser } from '../test/fixtures';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';
import { createSession, deleteAllSessions, purgeExpiredSessions } from './session-service';

const NOW = new Date('2026-11-10T12:00:00Z');
const NEW_PASSWORD = 'a brand new passphrase';

let db: Kysely<Database>;
let app: FastifyInstance;

beforeAll(async () => {
  db = await createMigratedTestDb();
  await insertUser(db, { email: 'new.hire@example.com', mustChangePassword: true });
  app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

function sessionsOf(userId: number) {
  return db.selectFrom('session').select('id').where('userId', '=', userId).execute();
}

function sessionStartedAt(userId: number, isoInstant: string) {
  return createSession({ db, now: () => new Date(isoInstant) }, userId);
}

describe('session hygiene', () => {
  it('deletes every session of a person', async () => {
    const userId = await insertUser(db, { email: 'everywhere@example.com' });
    await sessionStartedAt(userId, '2026-11-10T08:00:00Z');
    await sessionStartedAt(userId, '2026-11-10T09:00:00Z');

    await deleteAllSessions(db, userId);

    expect(await sessionsOf(userId)).toEqual([]);
  });

  it('purges expired and idle sessions but keeps live ones', async () => {
    const userId = await insertUser(db, { email: 'purge@example.com' });
    await sessionStartedAt(userId, '2026-11-01T12:00:00Z'); // past the 7-day limit
    await sessionStartedAt(userId, '2026-11-10T03:00:00Z'); // idle for 9 h
    await sessionStartedAt(userId, '2026-11-10T11:00:00Z'); // live

    await purgeExpiredSessions({ db, now: () => NOW });

    expect(await sessionsOf(userId)).toHaveLength(1);
  });

  it('purges dead sessions of everyone when someone logs in', async () => {
    const idleUserId = await insertUser(db, { email: 'idle@example.com' });
    await sessionStartedAt(idleUserId, '2026-11-01T12:00:00Z');
    await insertUser(db, { email: 'login@example.com' });

    await logIn(app, 'login@example.com');

    expect(await sessionsOf(idleUserId)).toEqual([]);
  });
});

describe('forced password change', () => {
  it('lets the person log in and says a change is required', async () => {
    const { cookie } = await logIn(app, 'new.hire@example.com');

    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });

    expect(me.json<{ user: { mustChangePassword: boolean } }>().user.mustChangePassword).toBe(true);
  });

  it('refuses every other protected route until the password is changed', async () => {
    const { cookie } = await logIn(app, 'new.hire@example.com');

    const response = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('clears the requirement once the person chooses a password', async () => {
    const { cookie, csrfToken } = await logIn(app, 'new.hire@example.com');

    const change = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/password',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: { currentPassword: DEFAULT_TEST_PASSWORD, newPassword: NEW_PASSWORD },
    });
    const users = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } });

    expect(change.statusCode).toBe(204);
    expect(users.statusCode).toBe(200);
  });
});
