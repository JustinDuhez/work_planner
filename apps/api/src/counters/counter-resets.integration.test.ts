import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 6 November 2026, 15:30 in Paris.
const NOW = new Date('2026-11-06T14:30:00Z');

describe('counter resets', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let memberCount = 0;
  let managerEmail: string;
  let managerId: number;

  async function newMember(): Promise<number> {
    memberCount += 1;
    const id = await insertUser(db, {
      email: `member${memberCount}@example.com`,
      startDate: '2026-10-19',
    });
    await db
      .insertInto('teamMember')
      .values({ teamId: await teamId(), userId: id })
      .execute();
    return id;
  }

  async function teamId(): Promise<number> {
    const { id } = await db
      .selectFrom('team')
      .select('id')
      .where('name', '=', 'Reset team')
      .executeTakeFirstOrThrow();
    return id;
  }

  async function postReset(email: string, ownerId: number, payload: Record<string, unknown> = {}) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method: 'POST',
      url: `/api/v1/users/${ownerId}/counter-resets`,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload,
    });
  }

  async function getResets(email: string, ownerId: number) {
    const { cookie } = await logIn(app, email);
    return app.inject({
      method: 'GET',
      url: `/api/v1/users/${ownerId}/counter-resets`,
      headers: { cookie },
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    managerEmail = 'sophie.reset@example.com';
    managerId = await insertUser(db, {
      email: managerEmail,
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    await insertTeam(db, { name: 'Reset team', managerId });
    const otherManagerId = await insertUser(db, { email: 'other.manager@example.com' });
    await insertTeam(db, { name: 'Other team', managerId: otherManagerId });
    await insertUser(db, {
      email: 'admin.reset@example.com',
      isAdmin: true,
      firstName: 'Inès',
      lastName: 'Garcia',
    });
    await insertUser(db, { email: 'colleague.reset@example.com' });
    await insertUser(db, { email: 'archived.reset@example.com', isArchived: true });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  describe('creating a reset', () => {
    it("lets a manager reset a member's counter from a past date", async () => {
      const memberId = await newMember();

      const response = await postReset(managerEmail, memberId, { resetDate: '2026-11-04' });

      expect(response.statusCode).toBe(201);
      expect(response.json<unknown>()).toMatchObject({
        resetDate: '2026-11-04',
        authorName: 'Sophie Dubois',
      });
    });

    it('resets from today when no date is given', async () => {
      const memberId = await newMember();

      const response = await postReset(managerEmail, memberId);

      expect(response.json<{ resetDate: string }>().resetDate).toBe('2026-11-06');
    });

    it('makes the week count from the new reset', async () => {
      const memberId = await newMember();
      await postReset(managerEmail, memberId, { resetDate: '2026-11-04' });
      const { cookie } = await logIn(app, 'colleague.reset@example.com');

      const week = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${memberId}/clock-weeks/2026-W45`,
        headers: { cookie },
      });

      expect(week.json<{ counters: unknown }>().counters).toMatchObject({
        countingStartDate: '2026-11-04',
        lastReset: { resetDate: '2026-11-04', authorName: 'Sophie Dubois' },
      });
    });

    it.each([
      ['a manager on their own counter', () => managerEmail, () => managerId],
      ['an admin on anyone', () => 'admin.reset@example.com', () => managerId],
    ])('lets %s reset it', async (_who, emailOf, ownerOf) => {
      const response = await postReset(emailOf(), ownerOf(), { resetDate: '2026-11-05' });

      expect(response.statusCode).toBe(201);
    });

    it.each([
      ['a colleague', 'colleague.reset@example.com'],
      ['the manager of another team', 'other.manager@example.com'],
    ])('refuses %s', async (_who, email) => {
      const memberId = await newMember();

      const response = await postReset(email, memberId);

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('COUNTER_RESET_FORBIDDEN');
    });

    it('refuses a person without a team resetting their own counter', async () => {
      const { id } = await db
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', 'colleague.reset@example.com')
        .executeTakeFirstOrThrow();

      expect((await postReset('colleague.reset@example.com', id)).statusCode).toBe(403);
    });

    it.each([
      ['in the future', '2026-11-07', 'COUNTER_RESET_DATE_IN_FUTURE'],
      ['before the start date', '2026-10-18', 'COUNTER_RESET_DATE_BEFORE_START'],
    ])('refuses a date %s', async (_description, resetDate, code) => {
      const memberId = await newMember();

      const response = await postReset(managerEmail, memberId, { resetDate });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ code: string }>().code).toBe(code);
    });

    it.each(['2026-13-01', '2026-02-30', '06/11/2026'])(
      'refuses the malformed date %s with a field error',
      async (resetDate) => {
        const memberId = await newMember();

        const response = await postReset(managerEmail, memberId, { resetDate });

        expect(response.statusCode).toBe(400);
        expect(
          response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.resetDate,
        ).toBeDefined();
      },
    );

    it('refuses unknown fields', async () => {
      const memberId = await newMember();

      expect((await postReset(managerEmail, memberId, { userId: 1 })).statusCode).toBe(400);
    });

    it('answers 404 for an unknown or archived person', async () => {
      const { id } = await db
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', 'archived.reset@example.com')
        .executeTakeFirstOrThrow();

      expect((await postReset('admin.reset@example.com', id)).json<{ code: string }>().code).toBe(
        'USER_NOT_FOUND',
      );
      expect((await postReset('admin.reset@example.com', 999_999)).statusCode).toBe(404);
    });
  });

  describe('the reset history', () => {
    it('lists the resets newest first for a manager', async () => {
      const memberId = await newMember();
      await postReset(managerEmail, memberId, { resetDate: '2026-11-03' });
      await postReset(managerEmail, memberId, { resetDate: '2026-11-05' });

      const response = await getResets(managerEmail, memberId);

      expect(response.statusCode).toBe(200);
      expect(response.json<{ resetDate: string }[]>().map((reset) => reset.resetDate)).toEqual([
        '2026-11-05',
        '2026-11-03',
      ]);
    });

    it('refuses the history to a colleague', async () => {
      const memberId = await newMember();

      const response = await getResets('colleague.reset@example.com', memberId);

      expect(response.statusCode).toBe(403);
    });
  });
});
