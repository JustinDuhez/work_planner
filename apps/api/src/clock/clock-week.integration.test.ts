import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertClockDay, insertClockPeriod, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock, type TestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 6 November 2026, 15:30 in Paris (winter time, UTC+1).
const NOW = new Date('2026-11-06T14:30:00Z');
const WEEK = '2026-W45';

interface WeekBody {
  user: { id: number };
  isoWeek: string;
  serverNow: string;
  weekWorkedMinutes: number;
  days: {
    date: string;
    workMode: string | null;
    periods: { startedAt: string; endedAt: string | null }[];
    workedMinutes: number;
    isToday: boolean;
    isFuture: boolean;
    isUnclosed: boolean;
    canEdit: boolean;
    canClose: boolean;
  }[];
}

describe('GET /api/v1/users/:userId/clock-weeks/:isoWeek', () => {
  let db: Kysely<Database>;
  let clock: TestClock;
  let app: FastifyInstance;
  let leaId: number;
  const managerEmail = 'manager.week@example.com';

  function dayOf(body: WeekBody, date: string) {
    const day = body.days.find((candidate) => candidate.date === date);
    if (!day) throw new Error(`No day ${date}`);
    return day;
  }

  async function getWeek(viewerEmail: string, ownerId: number, isoWeek = WEEK) {
    const { cookie } = await logIn(app, viewerEmail);
    return app.inject({
      method: 'GET',
      url: `/api/v1/users/${ownerId}/clock-weeks/${isoWeek}`,
      headers: { cookie },
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    leaId = await insertUser(db, { email: 'lea.week@example.com' });
    const managerId = await insertUser(db, { email: managerEmail });
    await insertUser(db, { email: 'outsider.week@example.com' });
    await insertUser(db, { email: 'admin.week@example.com', isAdmin: true });
    await insertUser(db, { email: 'archived.week@example.com', isArchived: true });
    await insertTeam(db, { name: 'Week team', managerId, memberIds: [leaId] });
    // Monday: a full day. Thursday: unclosed (afternoon never stopped). Friday (today): running.
    const monday = await insertClockDay(db, {
      userId: leaId,
      workDate: '2026-11-02',
      workMode: 'telework',
    });
    await insertClockPeriod(db, {
      clockDayId: monday,
      startedAt: new Date('2026-11-02T08:00:00Z'),
      endedAt: new Date('2026-11-02T11:30:00Z'),
    });
    await insertClockPeriod(db, {
      clockDayId: monday,
      startedAt: new Date('2026-11-02T12:30:00Z'),
      endedAt: new Date('2026-11-02T16:30:00Z'),
    });
    const thursday = await insertClockDay(db, { userId: leaId, workDate: '2026-11-05' });
    await insertClockPeriod(db, {
      clockDayId: thursday,
      startedAt: new Date('2026-11-05T08:00:00Z'),
      endedAt: new Date('2026-11-05T11:00:00Z'),
    });
    await insertClockPeriod(db, {
      clockDayId: thursday,
      startedAt: new Date('2026-11-05T12:00:00Z'),
    });
    const friday = await insertClockDay(db, { userId: leaId, workDate: '2026-11-06' });
    await insertClockPeriod(db, {
      clockDayId: friday,
      startedAt: new Date('2026-11-06T08:00:00Z'),
      endedAt: new Date('2026-11-06T11:00:00Z'),
    });
    await insertClockPeriod(db, {
      clockDayId: friday,
      startedAt: new Date('2026-11-06T12:30:00Z'),
    });
  });

  beforeEach(async () => {
    clock = createTestClock(NOW);
    app = await buildApp({ config: createTestConfig(), db, now: clock.now });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns the seven days of the week from Monday, with the server clock', async () => {
    const response = await getWeek('lea.week@example.com', leaId);
    const body = response.json<WeekBody>();

    expect(response.statusCode).toBe(200);
    expect(body.isoWeek).toBe(WEEK);
    expect(body.serverNow).toBe(NOW.toISOString());
    expect(body.days.map((day) => day.date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('totals closed periods and counts the running period up to now', async () => {
    const body = (await getWeek('lea.week@example.com', leaId)).json<WeekBody>();

    expect(dayOf(body, '2026-11-02')).toMatchObject({ workedMinutes: 450, workMode: 'telework' });
    expect(dayOf(body, '2026-11-06').workedMinutes).toBe(180 + 120);
  });

  it('flags a past day with an open period as unclosed and counts only its closed periods', async () => {
    const body = (await getWeek('lea.week@example.com', leaId)).json<WeekBody>();

    expect(dayOf(body, '2026-11-05')).toMatchObject({
      isUnclosed: true,
      workedMinutes: 180,
      canClose: true,
    });
  });

  it('adds up the week, and leaves untouched days empty', async () => {
    const body = (await getWeek('lea.week@example.com', leaId)).json<WeekBody>();

    expect(body.weekWorkedMinutes).toBe(450 + 180 + 300);
    expect(dayOf(body, '2026-11-03')).toMatchObject({
      workMode: null,
      periods: [],
      workedMinutes: 0,
    });
  });

  it('lets the owner edit only today, and marks future days', async () => {
    const body = (await getWeek('lea.week@example.com', leaId)).json<WeekBody>();

    expect(body.days.filter((day) => day.canEdit).map((day) => day.date)).toEqual(['2026-11-06']);
    expect(body.days.filter((day) => day.isFuture).map((day) => day.date)).toEqual([
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(dayOf(body, '2026-11-06').isToday).toBe(true);
  });

  it('shows another person read-only, and a colleague cannot close their unclosed day', async () => {
    const body = (await getWeek('outsider.week@example.com', leaId)).json<WeekBody>();

    expect(body.days.some((day) => day.canEdit)).toBe(false);
    expect(dayOf(body, '2026-11-05').canClose).toBe(false);
  });

  it.each([
    ['their manager', managerEmail, true],
    ['an admin', 'admin.week@example.com', true],
  ])('lets %s close the unclosed day', async (_who, email, expected) => {
    const body = (await getWeek(email, leaId)).json<WeekBody>();

    expect(dayOf(body, '2026-11-05').canClose).toBe(expected);
  });

  it('answers 404 for an archived or unknown person', async () => {
    const archived = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', 'archived.week@example.com')
      .executeTakeFirstOrThrow();

    expect((await getWeek('lea.week@example.com', archived.id)).json<{ code: string }>().code).toBe(
      'USER_NOT_FOUND',
    );
    expect((await getWeek('lea.week@example.com', 999_999)).statusCode).toBe(404);
  });

  it.each(['2026-45', '2025-W53'])('answers 400 for the invalid week %s', async (isoWeek) => {
    const response = await getWeek('lea.week@example.com', leaId, isoWeek);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('VALIDATION_ERROR');
  });

  it('counts real minutes on the 25-hour day of the autumn clock change', async () => {
    const dstDay = await insertClockDay(db, { userId: leaId, workDate: '2026-10-25' });
    // 01:00 → 04:00 Paris wall clock spans the repeated hour: 4 real hours.
    await insertClockPeriod(db, {
      clockDayId: dstDay,
      startedAt: new Date('2026-10-24T23:00:00Z'),
      endedAt: new Date('2026-10-25T03:00:00Z'),
    });

    const body = (await getWeek('lea.week@example.com', leaId, '2026-W43')).json<WeekBody>();

    expect(dayOf(body, '2026-10-25').workedMinutes).toBe(240);
  });
});
