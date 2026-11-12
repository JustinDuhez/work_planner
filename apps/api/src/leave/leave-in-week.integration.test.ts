import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertLeaveRequest, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Thursday 12 November 2026, 09:00 Paris.
const NOW = new Date('2026-11-12T08:00:00Z');

interface WeekBody {
  days: { date: string; badgeableMinutes: number; halfDays: { am: unknown; pm: unknown } }[];
  counters: { weekTargetMinutes: number; globalGapMinutes: number };
}

describe('leave in the week', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let userCount = 0;

  async function getWeek(email: string, userId: number, isoWeek: string): Promise<WeekBody> {
    const { cookie } = await logIn(app, email);
    return (
      await app.inject({
        method: 'GET',
        url: `/api/v1/users/${userId}/clock-weeks/${isoWeek}`,
        headers: { cookie },
      })
    ).json<WeekBody>();
  }

  async function newPerson(): Promise<{ id: number; email: string }> {
    userCount += 1;
    const email = `person${userCount}.week@example.com`;
    return { id: await insertUser(db, { email, startDate: '2026-10-19' }), email };
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    leaId = await insertUser(db, { email: 'lea.week@example.com', startDate: '2026-10-19' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('shows each half-day with its type and status', async () => {
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-16',
      startHalf: 'pm',
      endDate: '2026-11-16',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'telework',
      startDate: '2026-11-17',
      status: 'pending',
    });

    const week = await getWeek('lea.week@example.com', leaId, '2026-W47');

    expect(week.days[0]?.halfDays).toEqual({
      am: null,
      pm: { dayTypeCode: 'leave', status: 'approved' },
    });
    expect(week.days[1]?.halfDays).toEqual({
      am: { dayTypeCode: 'telework', status: 'pending' },
      pm: { dayTypeCode: 'telework', status: 'pending' },
    });
  });

  it('lowers the target only for approved absences, not pending ones or telework', async () => {
    const person = await newPerson();
    const before = await getWeek(person.email, person.id, '2026-W47');
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'leave',
      startDate: '2026-11-16',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'sick',
      startDate: '2026-11-17',
      status: 'pending',
    });
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'telework',
      startDate: '2026-11-18',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'early_departure',
      startDate: '2026-11-19',
      startHalf: 'pm',
      endDate: '2026-11-19',
      status: 'approved',
    });

    const after = await getWeek(person.email, person.id, '2026-W47');

    expect(after.counters.weekTargetMinutes).toBe(before.counters.weekTargetMinutes - 420 - 210);
    expect(after.days.map((day) => day.badgeableMinutes).slice(0, 5)).toEqual([
      0, 420, 420, 210, 420,
    ]);
  });

  it('raises the overall balance for a past approved absence', async () => {
    const person = await newPerson();
    const before = await getWeek(person.email, person.id, '2026-W46');
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'leave',
      startDate: '2026-11-10',
      status: 'approved',
    });

    const after = await getWeek(person.email, person.id, '2026-W46');

    expect(after.counters.globalGapMinutes).toBe(before.counters.globalGapMinutes + 420);
  });

  it('starts the day in telework when telework is approved for today', async () => {
    const person = await newPerson();
    await insertLeaveRequest(db, {
      userId: person.id,
      dayTypeCode: 'telework',
      startDate: '2026-11-12',
      status: 'approved',
    });
    const { cookie, csrfToken } = await logIn(app, person.email);

    await app.inject({
      method: 'POST',
      url: '/api/v1/clock-periods',
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload: {},
    });
    const day = await db
      .selectFrom('clockDay')
      .select('workMode')
      .where('userId', '=', person.id)
      .executeTakeFirstOrThrow();

    expect(day.workMode).toBe('telework');
  });
});
