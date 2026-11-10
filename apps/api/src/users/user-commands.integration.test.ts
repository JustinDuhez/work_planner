import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-10T09:00:00Z');
const ADMIN = 'ines.cmd@example.com';
const STRONG_PASSWORD = 'correct horse battery';

describe('user administration', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let adminId: number;
  let personCount = 0;
  const clock = createTestClock(NOW);
  const sessions = new Map<string, Awaited<ReturnType<typeof logIn>>>();

  async function send(
    email: string,
    method: 'POST' | 'PATCH' | 'PUT',
    url: string,
    payload: Record<string, unknown>,
  ) {
    // One login per sender: the login route allows 30 attempts a minute per IP.
    let session = sessions.get(email);
    if (!session) {
      session = await logIn(app, email);
      sessions.set(email, session);
    }
    const { cookie, csrfToken } = session;
    return app.inject({
      method,
      url,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload,
    });
  }

  async function newPerson(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: number; email: string }> {
    personCount += 1;
    const email = `person${personCount}.cmd@example.com`;
    return { id: await insertUser(db, { email, ...overrides }), email };
  }

  async function sessionCount(userId: number): Promise<number> {
    return (await db.selectFrom('session').select('id').where('userId', '=', userId).execute())
      .length;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    adminId = await insertUser(db, { email: ADMIN, isAdmin: true });
    await insertUser(db, { email: 'colleague.cmd@example.com' });
    app = await buildApp({ config: createTestConfig(), db, now: clock.now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  describe('creating', () => {
    it('creates a person who must choose their password, with default working time', async () => {
      const response = await send(ADMIN, 'POST', '/api/v1/users', {
        firstName: 'Zoé',
        lastName: 'Adam',
        email: 'zoe.adam@example.com',
        isAdmin: false,
        initialPassword: STRONG_PASSWORD,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<unknown>()).toMatchObject({
        email: 'zoe.adam@example.com',
        workingTime: { dailyMinutes: 420, startDate: '2026-11-10' },
      });
      const row = await db
        .selectFrom('appUser')
        .select(['mustChangePassword', 'passwordHash'])
        .where('email', '=', 'zoe.adam@example.com')
        .executeTakeFirstOrThrow();
      expect(row.mustChangePassword).toBe(true);
      expect(row.passwordHash).not.toBe(STRONG_PASSWORD);
    });

    it('refuses an email already in use', async () => {
      const response = await send(ADMIN, 'POST', '/api/v1/users', {
        firstName: 'A',
        lastName: 'B',
        email: 'colleague.cmd@example.com',
        isAdmin: false,
        initialPassword: STRONG_PASSWORD,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string }>().code).toBe('USER_EMAIL_TAKEN');
    });

    it('refuses a weak initial password with a field message', async () => {
      const response = await send(ADMIN, 'POST', '/api/v1/users', {
        firstName: 'A',
        lastName: 'B',
        email: 'weak@example.com',
        isAdmin: false,
        initialPassword: 'short',
      });

      expect(response.statusCode).toBe(400);
      expect(
        response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.initialPassword,
      ).toBeDefined();
    });

    it('refuses anyone but an admin', async () => {
      const response = await send('colleague.cmd@example.com', 'POST', '/api/v1/users', {
        firstName: 'A',
        lastName: 'B',
        email: 'nope@example.com',
        isAdmin: false,
        initialPassword: STRONG_PASSWORD,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('USER_MANAGEMENT_FORBIDDEN');
    });
  });

  describe('editing', () => {
    it.each([
      ['an email change', { email: 'changed.email@example.com' }],
      ['an admin-flag change', { isAdmin: true }],
      ['a block', { isBlocked: true }],
      ['an archive', { isArchived: true }],
    ])('logs the person out everywhere on %s', async (_change, payload) => {
      const person = await newPerson();
      await logIn(app, person.email);

      const response = await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, payload);

      expect(response.statusCode).toBe(200);
      expect(await sessionCount(person.id)).toBe(0);
    });

    it('keeps the sessions on a name change', async () => {
      const person = await newPerson();
      await logIn(app, person.email);

      await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, { firstName: 'Renamed' });

      expect(await sessionCount(person.id)).toBe(1);
    });

    it('archives and restores a person', async () => {
      const person = await newPerson();

      const archived = await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, {
        isArchived: true,
      });
      const restored = await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, {
        isArchived: false,
      });

      expect(archived.json<{ isArchived: boolean }>().isArchived).toBe(true);
      expect(restored.json<{ isArchived: boolean }>().isArchived).toBe(false);
    });

    it('refuses an email another person already uses', async () => {
      const person = await newPerson();

      const response = await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, {
        email: 'colleague.cmd@example.com',
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string }>().code).toBe('USER_EMAIL_TAKEN');
    });

    it('keeps the original archive date when archiving again later', async () => {
      const person = await newPerson();
      const archivedAt = async () =>
        (
          await db
            .selectFrom('appUser')
            .select('archivedAt')
            .where('id', '=', person.id)
            .executeTakeFirstOrThrow()
        ).archivedAt;
      await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, { isArchived: true });
      const first = await archivedAt();

      clock.advanceBy(3_600_000);
      await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, { isArchived: true });

      expect(first).not.toBeNull();
      expect(await archivedAt()).toEqual(first);
    });

    it.each([
      ['blocking yourself', { isBlocked: true }],
      ['archiving yourself', { isArchived: true }],
      ['removing your own admin rights', { isAdmin: false }],
    ])('refuses %s', async (_what, payload) => {
      const response = await send(ADMIN, 'PATCH', `/api/v1/users/${adminId}`, payload);

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('USER_SELF_RESTRICTION');
    });

    it('lets an admin demote a blocked admin: only active admins count', async () => {
      const blockedAdmin = await newPerson({ isAdmin: true, isBlocked: true });

      const response = await send(ADMIN, 'PATCH', `/api/v1/users/${blockedAdmin.id}`, {
        isAdmin: false,
      });

      expect(response.statusCode).toBe(200);
    });

    it('hides an archived person from the directory and their week, and restores both', async () => {
      const person = await newPerson();
      const { cookie } = await logIn(app, ADMIN);
      const directoryIds = async () =>
        (await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } }))
          .json<{ id: number }[]>()
          .map((entry) => entry.id);
      const weekStatus = async () =>
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/users/${person.id}/clock-weeks/2026-W46`,
            headers: { cookie },
          })
        ).statusCode;

      await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, { isArchived: true });
      const whileArchived = { ids: await directoryIds(), week: await weekStatus() };
      await send(ADMIN, 'PATCH', `/api/v1/users/${person.id}`, { isArchived: false });

      expect(whileArchived.ids).not.toContain(person.id);
      expect(whileArchived.week).toBe(404);
      expect(await directoryIds()).toContain(person.id);
      expect(await weekStatus()).toBe(200);
    });

    it('refuses to archive someone who manages a team, naming the team', async () => {
      const manager = await newPerson();
      await insertTeam(db, { name: 'Équipe Nord', managerId: manager.id });

      const response = await send(ADMIN, 'PATCH', `/api/v1/users/${manager.id}`, {
        isArchived: true,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string; message: string }>()).toMatchObject({
        code: 'USER_MANAGES_TEAM',
        message:
          "Cette personne gère l'équipe « Équipe Nord ». Désignez d'abord un autre responsable.",
      });
    });

    it('answers 404 for an unknown person', async () => {
      expect(
        (await send(ADMIN, 'PATCH', '/api/v1/users/999999', { firstName: 'X' })).statusCode,
      ).toBe(404);
    });
  });

  describe('who may manage', () => {
    it.each([
      ['a colleague', false],
      ['a team manager', true],
    ])(
      'refuses %s, for an edit and a password reset, leaving the person untouched',
      async (_who, isManager) => {
        const target = await newPerson();
        const actor = await newPerson();
        if (isManager) {
          await insertTeam(db, {
            name: `Managed by ${actor.email}`,
            managerId: actor.id,
            memberIds: [target.id],
          });
        }
        const before = await db
          .selectFrom('appUser')
          .selectAll()
          .where('id', '=', target.id)
          .executeTakeFirstOrThrow();

        const edit = await send(actor.email, 'PATCH', `/api/v1/users/${target.id}`, {
          firstName: 'X',
        });
        const reset = await send(actor.email, 'PUT', `/api/v1/users/${target.id}/password`, {
          newPassword: 'a fresh temporary one',
        });

        expect([edit.statusCode, reset.statusCode]).toEqual([403, 403]);
        expect([edit.json<{ code: string }>().code, reset.json<{ code: string }>().code]).toEqual([
          'USER_MANAGEMENT_FORBIDDEN',
          'USER_MANAGEMENT_FORBIDDEN',
        ]);
        expect(
          await db.selectFrom('appUser').selectAll().where('id', '=', target.id).executeTakeFirst(),
        ).toEqual(before);
      },
    );
  });

  describe('resetting a password', () => {
    it('sets a new password, logs out everywhere and forces a change', async () => {
      const person = await newPerson();
      await logIn(app, person.email);

      const response = await send(ADMIN, 'PUT', `/api/v1/users/${person.id}/password`, {
        newPassword: 'a fresh temporary one',
      });

      expect(response.statusCode).toBe(204);
      expect(await sessionCount(person.id)).toBe(0);
      const row = await db
        .selectFrom('appUser')
        .select('mustChangePassword')
        .where('id', '=', person.id)
        .executeTakeFirstOrThrow();
      expect(row.mustChangePassword).toBe(true);
    });
  });
});
