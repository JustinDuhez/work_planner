import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertClockDay, insertClockPeriod, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Monday 9 November 2026, 11:00 in Paris.
const NOW = new Date('2026-11-09T10:00:00Z');
const PAST_DAY = '2026-11-03';

describe('creating a correction', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let memberCount = 0;
  let teamId: number;
  const MANAGER = 'sophie.corrections@example.com';

  async function newMember(): Promise<number> {
    memberCount += 1;
    const id = await insertUser(db, {
      email: `member${memberCount}.corrections@example.com`,
      firstName: 'Léa',
      lastName: `Moreau${memberCount}`,
    });
    await db.insertInto('teamMember').values({ teamId, userId: id }).execute();
    return id;
  }

  async function workedDay(userId: number, periods: [string, string | null][]) {
    const dayId = await insertClockDay(db, { userId, workDate: PAST_DAY, workMode: 'telework' });
    for (const [start, end] of periods) {
      await insertClockPeriod(db, {
        clockDayId: dayId,
        startedAt: new Date(start),
        endedAt: end ? new Date(end) : null,
      });
    }
  }

  async function correct(email: string, body: Record<string, unknown>) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method: 'POST',
      url: '/api/v1/clock-corrections',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: body,
    });
  }

  function dayOf(userId: number, overrides: Record<string, unknown> = {}) {
    return {
      userId,
      date: PAST_DAY,
      workMode: 'on_site',
      periods: [{ startedAt: '09:00', endedAt: '17:00' }],
      ...overrides,
    };
  }

  async function periodsOf(userId: number) {
    return db
      .selectFrom('clockPeriod')
      .innerJoin('clockDay', 'clockDay.id', 'clockPeriod.clockDayId')
      .select(['clockPeriod.startedAt', 'clockPeriod.endedAt', 'clockDay.workMode'])
      .where('clockDay.userId', '=', userId)
      .where('clockDay.workDate', '=', PAST_DAY)
      .orderBy('clockPeriod.startedAt')
      .execute();
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const managerId = await insertUser(db, {
      email: MANAGER,
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    teamId = await insertTeam(db, { name: 'Corrections team', managerId });
    const otherManagerId = await insertUser(db, { email: 'other.corrections@example.com' });
    await insertTeam(db, { name: 'Other corrections team', managerId: otherManagerId });
    await insertUser(db, { email: 'admin.corrections@example.com', isAdmin: true });
    await insertUser(db, { email: 'colleague.corrections@example.com' });
    await insertUser(db, { email: 'archived.corrections@example.com', isArchived: true });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it("replaces the day's periods and work mode and records before and after", async () => {
    const memberId = await newMember();
    await workedDay(memberId, [
      ['2026-11-03T08:00:00Z', '2026-11-03T11:00:00Z'],
      ['2026-11-03T12:00:00Z', null],
    ]);

    const response = await correct(MANAGER, dayOf(memberId, { comment: 'Réunion client oubliée' }));

    expect(response.statusCode).toBe(201);
    expect(response.json<unknown>()).toMatchObject({
      status: 'pending',
      comment: 'Réunion client oubliée',
      author: { firstName: 'Sophie', lastName: 'Dubois' },
      before: { workMode: 'telework', workedMinutes: 180 },
      after: { workMode: 'on_site', workedMinutes: 480 },
      differenceMinutes: 300,
      canAnswer: false,
    });
    expect(await periodsOf(memberId)).toEqual([
      {
        startedAt: new Date('2026-11-03T08:00:00Z'),
        endedAt: new Date('2026-11-03T16:00:00Z'),
        workMode: 'on_site',
      },
    ]);
  });

  it('notifies the person', async () => {
    const memberId = await newMember();

    const correction = (await correct(MANAGER, dayOf(memberId))).json<{ id: number }>();

    const notifications = await db
      .selectFrom('notification')
      .select(['type', 'payload', 'readAt'])
      .where('userId', '=', memberId)
      .execute();
    expect(notifications).toEqual([
      {
        type: 'clock_correction_received',
        payload: {
          correctionId: correction.id,
          ownerId: memberId,
          workDate: PAST_DAY,
          actorName: 'Sophie Dubois',
        },
        readAt: null,
      },
    ]);
  });

  it('creates the day when it had no record, with no work mode before', async () => {
    const memberId = await newMember();

    const response = await correct(MANAGER, dayOf(memberId));

    expect(response.json<{ before: unknown }>().before).toEqual({
      workMode: null,
      periods: [],
      workedMinutes: 0,
    });
  });

  it('empties a day', async () => {
    const memberId = await newMember();
    await workedDay(memberId, [['2026-11-03T08:00:00Z', '2026-11-03T11:00:00Z']]);

    await correct(MANAGER, dayOf(memberId, { periods: [] }));

    expect(await periodsOf(memberId)).toEqual([]);
  });

  it('supersedes a pending correction of the same day and marks its notification read', async () => {
    const memberId = await newMember();
    const first = (await correct(MANAGER, dayOf(memberId))).json<{ id: number }>();

    const second = await correct(
      MANAGER,
      dayOf(memberId, { periods: [{ startedAt: '10:00', endedAt: '17:00' }] }),
    );

    const statuses = await db
      .selectFrom('clockCorrection')
      .select(['id', 'status'])
      .where('userId', '=', memberId)
      .orderBy('id')
      .execute();
    expect(statuses).toEqual([
      { id: first.id, status: 'superseded' },
      { id: second.json<{ id: number }>().id, status: 'pending' },
    ]);
    expect(second.json<{ before: { workedMinutes: number } }>().before.workedMinutes).toBe(480);
    const unread = await db
      .selectFrom('notification')
      .select('id')
      .where('userId', '=', memberId)
      .where('readAt', 'is', null)
      .execute();
    expect(unread).toHaveLength(1);
  });

  it('serializes two simultaneous corrections of the same day: exactly one stays pending', async () => {
    const memberId = await newMember();

    const responses = await Promise.all([
      correct(MANAGER, dayOf(memberId)),
      correct(MANAGER, dayOf(memberId)),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    const pending = await db
      .selectFrom('clockCorrection')
      .select('id')
      .where('userId', '=', memberId)
      .where('status', '=', 'pending')
      .execute();
    expect(pending).toHaveLength(1);
  });

  it('accepts a manager correcting their own day at once, without a notification', async () => {
    const { id: managerId } = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', MANAGER)
      .executeTakeFirstOrThrow();

    const response = await correct(MANAGER, dayOf(managerId));

    expect(response.json<{ status: string; respondedAt: string }>()).toMatchObject({
      status: 'accepted',
      respondedAt: NOW.toISOString(),
    });
    expect(
      await db.selectFrom('notification').select('id').where('userId', '=', managerId).execute(),
    ).toEqual([]);
  });

  it('lets an admin correct anyone', async () => {
    const memberId = await newMember();

    expect((await correct('admin.corrections@example.com', dayOf(memberId))).statusCode).toBe(201);
  });

  it.each([
    ['a colleague', 'colleague.corrections@example.com'],
    ['the manager of another team', 'other.corrections@example.com'],
  ])('refuses %s', async (_who, email) => {
    const memberId = await newMember();

    const response = await correct(email, dayOf(memberId));

    expect(response.statusCode).toBe(403);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_FORBIDDEN');
  });

  it('refuses a person who is not a manager correcting their own day', async () => {
    const { id } = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', 'colleague.corrections@example.com')
      .executeTakeFirstOrThrow();

    expect((await correct('colleague.corrections@example.com', dayOf(id))).statusCode).toBe(403);
  });

  it.each([
    ['today', '2026-11-09'],
    ['a future day', '2026-11-10'],
  ])('refuses to correct %s', async (_what, date) => {
    const memberId = await newMember();

    const response = await correct(MANAGER, dayOf(memberId, { date, periods: [] }));

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_CORRECTION_DAY_NOT_PAST');
  });

  it('points at the faulty period with the E3 message', async () => {
    const memberId = await newMember();

    const response = await correct(
      MANAGER,
      dayOf(memberId, {
        periods: [
          { startedAt: '09:00', endedAt: '12:00' },
          { startedAt: '11:00', endedAt: '13:00' },
        ],
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({
      code: 'CLOCK_PERIOD_OVERLAP',
      fieldErrors: { 'periods.1.startedAt': 'Cette période chevauche une autre période.' },
    });
  });

  it('refuses a time that does not exist on the day the clocks change', async () => {
    const memberId = await newMember();

    const response = await correct(
      MANAGER,
      dayOf(memberId, { date: '2026-03-29', periods: [{ startedAt: '02:30', endedAt: '04:00' }] }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({
      code: 'CLOCK_TIME_INVALID',
      fieldErrors: {
        'periods.0.startedAt': "Cette heure n'existe pas ce jour-là (changement d'heure).",
      },
    });
  });

  it('points at the end of a period that ends before it starts', async () => {
    const memberId = await newMember();

    const response = await correct(
      MANAGER,
      dayOf(memberId, { periods: [{ startedAt: '12:00', endedAt: '11:00' }] }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toMatchObject({
      code: 'CLOCK_END_BEFORE_START',
      fieldErrors: { 'periods.0.endedAt': "L'heure de fin doit être après l'heure de début." },
    });
  });

  it('refuses an impossible date', async () => {
    const memberId = await newMember();

    const response = await correct(MANAGER, dayOf(memberId, { date: '2026-02-30', periods: [] }));

    expect(response.statusCode).toBe(400);
    expect(response.json<{ fieldErrors: Record<string, string> }>().fieldErrors.date).toBeDefined();
  });

  it('answers 404 for an archived or unknown person', async () => {
    const { id } = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', 'archived.corrections@example.com')
      .executeTakeFirstOrThrow();

    expect((await correct('admin.corrections@example.com', dayOf(id))).statusCode).toBe(404);
    expect((await correct('admin.corrections@example.com', dayOf(999_999))).statusCode).toBe(404);
  });
});
