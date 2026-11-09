import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-09T10:00:00Z');
const MANAGER = 'sophie.answers@example.com';

interface CorrectionBody {
  id: number;
  status: string;
  responseComment: string | null;
  canAnswer: boolean;
}

describe('answering a correction', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let memberCount = 0;
  let teamId: number;
  const sessions = new Map<string, ReturnType<typeof logIn>>();

  async function send(
    email: string,
    method: 'POST' | 'PATCH' | 'GET',
    url: string,
    payload?: Record<string, unknown>,
  ) {
    // Logins are rate limited per email, so each person logs in once.
    const session = sessions.get(email) ?? logIn(app, email);
    sessions.set(email, session);
    const { cookie, csrfToken } = await session;
    return app.inject({
      method,
      url,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      ...(payload ? { payload } : {}),
    });
  }

  function answeredNotifications(correctionId: number) {
    return db
      .selectFrom('notification')
      .select('payload')
      .where('type', '=', 'clock_correction_answered')
      .where(sql<boolean>`payload->>'correctionId' = ${String(correctionId)}`)
      .execute();
  }

  async function newMember(): Promise<{ id: number; email: string }> {
    memberCount += 1;
    const email = `member${memberCount}.answers@example.com`;
    const id = await insertUser(db, { email, firstName: 'Léa', lastName: 'Moreau' });
    await db.insertInto('teamMember').values({ teamId, userId: id }).execute();
    return { id, email };
  }

  async function correctionFor(ownerId: number, date = '2026-11-03'): Promise<CorrectionBody> {
    const response = await send(MANAGER, 'POST', '/api/v1/clock-corrections', {
      userId: ownerId,
      date,
      workMode: 'on_site',
      periods: [{ startedAt: '09:00', endedAt: '17:00' }],
    });
    return response.json<CorrectionBody>();
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const managerId = await insertUser(db, {
      email: MANAGER,
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    teamId = await insertTeam(db, { name: 'Answers team', managerId });
    await insertUser(db, { email: 'colleague.answers@example.com' });
    await insertUser(db, { email: 'admin.answers@example.com', isAdmin: true });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lets the person see the correction and answer it', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    const view = await send(member.email, 'GET', `/api/v1/clock-corrections/${correction.id}`);

    expect(view.json<CorrectionBody>().canAnswer).toBe(true);
  });

  it('records a refusal with its comment and tells the author', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    const response = await send(
      member.email,
      'PATCH',
      `/api/v1/clock-corrections/${correction.id}`,
      {
        status: 'refused',
        responseComment: "J'étais en déplacement.",
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json<CorrectionBody>()).toMatchObject({
      status: 'refused',
      responseComment: "J'étais en déplacement.",
      canAnswer: false,
    });
    const { id: managerId } = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', MANAGER)
      .executeTakeFirstOrThrow();
    const answered = await db
      .selectFrom('notification')
      .select(['type', 'payload'])
      .where('userId', '=', managerId)
      .execute();
    expect(answered).toEqual([
      {
        type: 'clock_correction_answered',
        payload: {
          correctionId: correction.id,
          ownerId: member.id,
          workDate: '2026-11-03',
          actorName: 'Léa Moreau',
          status: 'refused',
        },
      },
    ]);
  });

  it('does not change the day when the person refuses', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    await send(member.email, 'PATCH', `/api/v1/clock-corrections/${correction.id}`, {
      status: 'refused',
    });

    const periods = await db
      .selectFrom('clockPeriod')
      .innerJoin('clockDay', 'clockDay.id', 'clockPeriod.clockDayId')
      .select('clockPeriod.endedAt')
      .where('clockDay.userId', '=', member.id)
      .execute();
    expect(periods).toEqual([{ endedAt: new Date('2026-11-03T16:00:00Z') }]);
  });

  it('refuses an answer from anyone but the person', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    const response = await send(MANAGER, 'PATCH', `/api/v1/clock-corrections/${correction.id}`, {
      status: 'accepted',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_ANSWER_FORBIDDEN');
  });

  it.each([
    [
      'already answered',
      async (member: { id: number; email: string }, id: number) => {
        await send(member.email, 'PATCH', `/api/v1/clock-corrections/${id}`, {
          status: 'accepted',
        });
      },
    ],
    [
      'superseded',
      async (member: { id: number }) => {
        await correctionFor(member.id);
      },
    ],
  ])('refuses to answer a correction %s', async (_state, makeUnanswerable) => {
    const member = await newMember();
    const correction = await correctionFor(member.id);
    await makeUnanswerable(member, correction.id);

    const response = await send(
      member.email,
      'PATCH',
      `/api/v1/clock-corrections/${correction.id}`,
      { status: 'refused' },
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_NOT_PENDING');
  });

  it('lets only one of two simultaneous answers through', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    // One login, so both PATCHes really reach the server together.
    const { cookie, csrfToken } = await logIn(app, member.email);
    const answer = (status: string) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/clock-corrections/${correction.id}`,
        headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
        payload: { status },
      });

    const responses = await Promise.all([answer('accepted'), answer('refused')]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(await answeredNotifications(correction.id)).toHaveLength(1);
  });

  it('returns 404 for a correction that does not exist', async () => {
    const response = await send(MANAGER, 'GET', '/api/v1/clock-corrections/999999');

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_NOT_FOUND');
  });

  it.each([MANAGER, 'admin.answers@example.com'])(
    'lets %s view a correction without answering it',
    async (email) => {
      const member = await newMember();
      const correction = await correctionFor(member.id);

      const response = await send(email, 'GET', `/api/v1/clock-corrections/${correction.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.json<CorrectionBody>().canAnswer).toBe(false);
    },
  );

  it('answers 404 for the list of an unknown or archived person', async () => {
    const archivedId = await insertUser(db, {
      email: 'archived.answers@example.com',
      isArchived: true,
    });

    for (const id of [999999, archivedId]) {
      const response = await send(MANAGER, 'GET', `/api/v1/users/${id}/clock-corrections`);
      expect(response.statusCode).toBe(404);
      expect(response.json<{ code: string }>().code).toBe('USER_NOT_FOUND');
    }
  });

  it('lists every status without a filter and rejects an invalid one', async () => {
    const member = await newMember();
    const first = await correctionFor(member.id, '2026-11-02');
    const second = await correctionFor(member.id, '2026-11-04');
    await send(member.email, 'PATCH', `/api/v1/clock-corrections/${second.id}`, {
      status: 'accepted',
    });

    const all = await send(member.email, 'GET', `/api/v1/users/${member.id}/clock-corrections`);
    const invalid = await send(
      member.email,
      'GET',
      `/api/v1/users/${member.id}/clock-corrections?statut=maybe`,
    );

    expect(all.json<CorrectionBody[]>().map((item) => item.id)).toEqual([second.id, first.id]);
    expect(invalid.statusCode).toBe(400);
  });

  it('records an accepted answer, stores an empty comment as null and tells the author', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    const response = await send(
      member.email,
      'PATCH',
      `/api/v1/clock-corrections/${correction.id}`,
      { status: 'accepted', responseComment: '' },
    );

    expect(response.json<CorrectionBody>()).toMatchObject({
      status: 'accepted',
      responseComment: null,
    });
    expect(await answeredNotifications(correction.id)).toMatchObject([
      { payload: { status: 'accepted' } },
    ]);
  });

  it('hides a correction from a colleague as if it did not exist', async () => {
    const member = await newMember();
    const correction = await correctionFor(member.id);

    const response = await send(
      'colleague.answers@example.com',
      'GET',
      `/api/v1/clock-corrections/${correction.id}`,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_NOT_FOUND');
  });

  it("lists a person's refused corrections newest first, for them and for an admin", async () => {
    const member = await newMember();
    const older = await correctionFor(member.id, '2026-11-02');
    const newer = await correctionFor(member.id, '2026-11-04');
    await send(member.email, 'PATCH', `/api/v1/clock-corrections/${older.id}`, {
      status: 'refused',
    });
    await send(member.email, 'PATCH', `/api/v1/clock-corrections/${newer.id}`, {
      status: 'refused',
    });

    for (const email of [member.email, 'admin.answers@example.com']) {
      const response = await send(
        email,
        'GET',
        `/api/v1/users/${member.id}/clock-corrections?statut=refused`,
      );
      expect(response.json<CorrectionBody[]>().map((item) => item.id)).toEqual([
        newer.id,
        older.id,
      ]);
    }
  });

  it("refuses a colleague the list of someone's corrections", async () => {
    const member = await newMember();

    const response = await send(
      'colleague.answers@example.com',
      'GET',
      `/api/v1/users/${member.id}/clock-corrections`,
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_FORBIDDEN');
  });
});
