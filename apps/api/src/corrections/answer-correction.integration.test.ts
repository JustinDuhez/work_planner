import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
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

  async function send(
    email: string,
    method: 'POST' | 'PATCH' | 'GET',
    url: string,
    payload?: Record<string, unknown>,
  ) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method,
      url,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      ...(payload ? { payload } : {}),
    });
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

    const responses = await Promise.all([
      send(member.email, 'PATCH', `/api/v1/clock-corrections/${correction.id}`, {
        status: 'accepted',
      }),
      send(member.email, 'PATCH', `/api/v1/clock-corrections/${correction.id}`, {
        status: 'refused',
      }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
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
