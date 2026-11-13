import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertLeaveRequest, insertPublicHoliday, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const NOW = new Date('2026-11-13T09:00:00Z');

interface CalendarBody {
  user: { firstName: string };
  period: { startDate: string; endDate: string };
  halfDays: {
    date: string;
    half: string;
    dayTypeCode: string;
    status: string;
    leaveRequestId: number;
  }[];
  holidays: { date: string }[];
  summary: { dayTypeCode: string; approvedHalfDays: number; pendingHalfDays: number }[];
  holidayCount: number;
  canDeclare: boolean;
  today: string;
}

describe('the year calendar', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let archivedId: number;

  async function get(email: string, url: string) {
    const { cookie } = await logIn(app, email);
    return app.inject({ method: 'GET', url, headers: { cookie } });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const sophieId = await insertUser(db, { email: 'sophie.cal@example.com' });
    leaId = await insertUser(db, { email: 'lea.cal@example.com', firstName: 'Léa' });
    await insertUser(db, { email: 'hugo.cal@example.com' });
    await insertUser(db, { email: 'ines.cal@example.com', isAdmin: true });
    archivedId = await insertUser(db, { email: 'chloe.cal@example.com', isArchived: true });
    await insertTeam(db, { name: 'Front', managerId: sophieId, memberIds: [leaId] });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      endDate: '2026-11-24',
      reason: 'Vacances secrètes',
      reviewComment: 'Bon voyage',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'telework',
      startDate: '2026-12-01',
      startHalf: 'pm',
      endDate: '2026-12-01',
      status: 'pending',
    });
    // Outside period 2026 (1 July 2026 – 30 June 2027).
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'sick',
      startDate: '2026-06-29',
      status: 'approved',
    });
    await insertPublicHoliday(db, { date: '2026-12-25', label: 'Noël' });
    await insertPublicHoliday(db, { date: '2027-01-01', label: "Jour de l'an" });
    await insertPublicHoliday(db, { date: '2026-05-01', label: 'Fête du Travail' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('gives a colleague the period, half-days, holidays and usage, without the right to declare', async () => {
    const calendar = (
      await get('hugo.cal@example.com', `/api/v1/users/${leaId}/year-calendars/2026`)
    ).json<CalendarBody>();

    expect(calendar.period).toEqual({ startDate: '2026-07-01', endDate: '2027-06-30' });
    expect(calendar.halfDays).toHaveLength(5);
    expect(typeof calendar.halfDays[0]?.leaveRequestId).toBe('number');
    expect(calendar.halfDays[0]).toEqual({
      date: '2026-11-23',
      half: 'am',
      dayTypeCode: 'leave',
      status: 'approved',
      leaveRequestId: calendar.halfDays[0]?.leaveRequestId,
    });
    expect(calendar.holidays.map((holiday) => holiday.date)).toEqual(['2026-12-25', '2027-01-01']);
    expect(calendar.holidayCount).toBe(2);
    expect(calendar.summary).toEqual([
      { dayTypeCode: 'telework', approvedHalfDays: 0, pendingHalfDays: 1 },
      { dayTypeCode: 'leave', approvedHalfDays: 4, pendingHalfDays: 0 },
    ]);
    expect(calendar.canDeclare).toBe(false);
    expect(calendar.today).toBe('2026-11-13');
  });

  it('never sends reasons or comments', async () => {
    const body = (await get('hugo.cal@example.com', `/api/v1/users/${leaId}/year-calendars/2026`))
      .body;

    expect(body).not.toMatch(/reason|ruleNote|reviewComment/);
    expect(body).not.toMatch(/secrètes|Bon voyage/);
  });

  it.each([
    ['the manager', 'sophie.cal@example.com', true],
    ['an admin', 'ines.cal@example.com', true],
    ['the person', 'lea.cal@example.com', false],
  ])('tells %s whether they may declare', async (_who, email, canDeclare) => {
    expect(
      (await get(email, `/api/v1/users/${leaId}/year-calendars/2026`)).json<CalendarBody>()
        .canDeclare,
    ).toBe(canDeclare);
  });

  it('answers 404 for an archived person and 400 for a year out of range', async () => {
    expect(
      (await get('hugo.cal@example.com', `/api/v1/users/${archivedId}/year-calendars/2026`))
        .statusCode,
    ).toBe(404);
    expect(
      (await get('hugo.cal@example.com', `/api/v1/users/${leaId}/year-calendars/1999`)).statusCode,
    ).toBe(400);
  });

  it('follows the year start setting', async () => {
    await db
      .updateTable('setting')
      .set({ value: '01-01' })
      .where('key', '=', 'year_start')
      .execute();

    const calendar = (
      await get('hugo.cal@example.com', `/api/v1/users/${leaId}/year-calendars/2026`)
    ).json<CalendarBody>();

    await db
      .updateTable('setting')
      .set({ value: '07-01' })
      .where('key', '=', 'year_start')
      .execute();
    expect(calendar.period).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(calendar.halfDays.map((halfDay) => halfDay.dayTypeCode)).toContain('sick');
  });
});
