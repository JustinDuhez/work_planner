import type { FastifyInstance } from 'fastify';
import type { Kysely, KyselyPlugin } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import {
  insertClockDay,
  insertClockPeriod,
  insertCounterReset,
  insertDailyMinutesChange,
  insertPublicHoliday,
  insertTeam,
  insertUser,
} from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';
import { findCounterProfile } from './counter-repository';
import { loadCounterFacts } from './counter-facts';

// Friday 6 November 2026, 15:30 in Paris (UTC+1).
const NOW = new Date('2026-11-06T14:30:00Z');

interface CountersBody {
  serverNow: string;
  days: {
    date: string;
    badgeableMinutes: number;
    workedMinutes: number;
    holidayLabel: string | null;
  }[];
  counters: {
    weekTargetMinutes: number;
    weekBadgeableMinutes: number;
    weekCountedWorkedMinutes: number;
    weekGapMinutes: number;
    globalGapMinutes: number;
    startDate: string;
    countingStartDate: string;
    runningSince: string | null;
    canResetCounter: boolean;
    lastReset: { resetDate: string; authorName: string } | null;
  };
}

async function workedDay(db: Kysely<Database>, userId: number, workDate: string, minutes: number) {
  const dayId = await insertClockDay(db, { userId, workDate });
  const startedAt = new Date(`${workDate}T08:00:00Z`);
  await insertClockPeriod(db, {
    clockDayId: dayId,
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
  });
}

describe('counters in the week', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let managerId: number;

  async function getWeek(viewerEmail: string, ownerId: number, isoWeek = '2026-W45') {
    const { cookie } = await logIn(app, viewerEmail);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${ownerId}/clock-weeks/${isoWeek}`,
      headers: { cookie },
    });
    return response.json<CountersBody>();
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    // Léa started on Monday 19 October; W43 and W44 are past weeks, W45 is the current one.
    leaId = await insertUser(db, { email: 'lea.counters@example.com', startDate: '2026-10-19' });
    managerId = await insertUser(db, {
      email: 'manager.counters@example.com',
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    await insertUser(db, { email: 'colleague.counters@example.com' });
    await insertTeam(db, { name: 'Counters team', managerId, memberIds: [leaId] });
    // W44: 5 × 7:30 worked (+2:30). W45: Mon 7:00, Tue 6:00, Wed 7:00, Thu 7:00, Fri running since 09:00 Paris.
    for (const date of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) {
      await workedDay(db, leaId, date, 450);
    }
    await workedDay(db, leaId, '2026-11-02', 420);
    await workedDay(db, leaId, '2026-11-03', 360);
    await workedDay(db, leaId, '2026-11-04', 420);
    await workedDay(db, leaId, '2026-11-05', 420);
    const friday = await insertClockDay(db, { userId: leaId, workDate: '2026-11-06' });
    await insertClockPeriod(db, {
      clockDayId: friday,
      startedAt: new Date('2026-11-06T08:00:00Z'),
    });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lowers the week target for a public holiday and restores it when deleted', async () => {
    const before = await getWeek('lea.counters@example.com', leaId, '2026-W46');
    await insertPublicHoliday(db, { date: '2026-11-11', label: 'Armistice 1918' });
    const withHoliday = await getWeek('lea.counters@example.com', leaId, '2026-W46');
    await db.deleteFrom('publicHoliday').where('holidayDate', '=', '2026-11-11').execute();
    const after = await getWeek('lea.counters@example.com', leaId, '2026-W46');

    expect(withHoliday.counters.weekTargetMinutes).toBe(before.counters.weekTargetMinutes - 420);
    expect(withHoliday.days[2]).toMatchObject({
      badgeableMinutes: 0,
      holidayLabel: 'Armistice 1918',
    });
    expect(after.counters.weekTargetMinutes).toBe(before.counters.weekTargetMinutes);
    expect(after.days[2]?.holidayLabel).toBeNull();
  });

  it('gives each day of the week its badgeable time', async () => {
    const body = await getWeek('colleague.counters@example.com', leaId);

    expect(body.days.map((day) => day.badgeableMinutes)).toEqual([420, 420, 420, 420, 420, 0, 0]);
  });

  it('counts the week: full target, badgeable time of the ended days, worked time up to now', async () => {
    const { counters } = await getWeek('colleague.counters@example.com', leaId);

    expect(counters).toMatchObject({
      weekTargetMinutes: 5 * 420,
      weekBadgeableMinutes: 4 * 420,
      weekCountedWorkedMinutes: 420 + 360 + 420 + 420 + 390,
      weekGapMinutes: 330,
      runningSince: '2026-11-06T08:00:00.000Z',
    });
  });

  it('adds every counted day since the start date to the global gap', async () => {
    const { counters } = await getWeek('colleague.counters@example.com', leaId);

    // W43: nothing worked (−35:00). W44: +2:30. W45: +5:30.
    expect(counters).toMatchObject({
      startDate: '2026-10-19',
      countingStartDate: '2026-10-19',
      globalGapMinutes: -2100 + 150 + 330,
      lastReset: null,
    });
  });

  it('shows the counters to a colleague but lets only the manager reset them', async () => {
    expect((await getWeek('colleague.counters@example.com', leaId)).counters.canResetCounter).toBe(
      false,
    );
    expect((await getWeek('manager.counters@example.com', leaId)).counters.canResetCounter).toBe(
      true,
    );
  });

  it('counts from the most recently created reset, even when its date is earlier', async () => {
    const otherId = await insertUser(db, {
      email: 'reset.order@example.com',
      startDate: '2026-10-19',
    });
    await insertCounterReset(db, {
      userId: otherId,
      resetDate: '2026-11-04',
      authorId: managerId,
      createdAt: new Date('2026-11-04T10:00:00Z'),
    });
    await insertCounterReset(db, {
      userId: otherId,
      resetDate: '2026-11-03',
      authorId: managerId,
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });

    const { counters } = await getWeek('colleague.counters@example.com', otherId);

    expect(counters.countingStartDate).toBe('2026-11-03');
    expect(counters.lastReset).toMatchObject({
      resetDate: '2026-11-03',
      authorName: 'Sophie Dubois',
    });
    expect(counters.globalGapMinutes).toBe(-3 * 420);
  });

  it('uses the daily time in force on each day', async () => {
    const partTimeId = await insertUser(db, {
      email: 'part.time@example.com',
      dailyMinutes: 360,
      startDate: '2026-11-02',
    });
    await insertDailyMinutesChange(db, {
      userId: partTimeId,
      effectiveDate: '2026-11-04',
      previousDailyMinutes: 420,
      authorId: managerId,
    });

    const body = await getWeek('colleague.counters@example.com', partTimeId);

    expect(body.days.map((day) => day.badgeableMinutes).slice(0, 5)).toEqual([
      420, 420, 360, 360, 360,
    ]);
  });

  it('counts nothing in a week before the start date', async () => {
    const { counters, days } = await getWeek('colleague.counters@example.com', leaId, '2026-W42');

    expect(days.every((day) => day.badgeableMinutes === 0)).toBe(true);
    expect(counters).toMatchObject({ weekTargetMinutes: 0, weekGapMinutes: 0 });
  });

  it('reads the clock once, so the counters and the days agree on the instant', async () => {
    let calls = 0;
    const tickingApp = await buildApp({
      config: createTestConfig(),
      db,
      now: () => new Date(NOW.getTime() + calls++ * 60_000),
    });
    const { cookie } = await logIn(tickingApp, 'colleague.counters@example.com');

    const response = await tickingApp.inject({
      method: 'GET',
      url: `/api/v1/users/${leaId}/clock-weeks/2026-W45`,
      headers: { cookie },
    });
    await tickingApp.close();
    const { counters, days, serverNow } = response.json<CountersBody>();

    // Léa's Friday period started at 08:00Z and is still running at the answer's instant.
    const fridayMinutes = (Date.parse(serverNow) - Date.parse('2026-11-06T08:00:00Z')) / 60_000;
    expect(days[4]?.workedMinutes).toBe(fridayMinutes);
    expect(counters.weekCountedWorkedMinutes).toBe(
      days.reduce((total, day) => total + day.workedMinutes, 0),
    );
  });

  it('shows no running time before the counting start', async () => {
    const futureId = await insertUser(db, {
      email: 'future.start@example.com',
      startDate: '2026-11-07',
    });
    const today = await insertClockDay(db, { userId: futureId, workDate: '2026-11-06' });
    await insertClockPeriod(db, {
      clockDayId: today,
      startedAt: new Date('2026-11-06T08:00:00Z'),
    });

    const { counters } = await getWeek('colleague.counters@example.com', futureId);

    expect(counters).toMatchObject({ runningSince: null, globalGapMinutes: 0 });
  });

  it('loads the counter facts in four queries, however long the history', async () => {
    const countingPlugin: KyselyPlugin = {
      transformQuery: (args) => {
        queryCount += 1;
        return args.node;
      },
      transformResult: (args) => Promise.resolve(args.result),
    };
    let queryCount = 0;
    const countQueries = async (userId: number) => {
      const profile = await findCounterProfile(db, userId);
      if (!profile) throw new Error('The person should exist');
      queryCount = 0;
      await loadCounterFacts(db.withPlugin(countingPlugin), { profile, today: '2026-11-06' });
      return queryCount;
    };
    const fewDaysId = await insertUser(db, {
      email: 'few.days@example.com',
      startDate: '2026-11-04',
    });
    await workedDay(db, fewDaysId, '2026-11-04', 420);

    expect(await countQueries(fewDaysId)).toBe(4);
    expect(await countQueries(leaId)).toBe(4);
  });
});
