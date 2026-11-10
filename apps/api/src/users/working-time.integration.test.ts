import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Tuesday 10 November 2026.
const NOW = new Date('2026-11-10T09:00:00Z');
const MANAGER = 'sophie.time@example.com';
const ADMIN = 'ines.time@example.com';

describe('working time', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let teamId: number;
  let memberCount = 0;

  async function patch(email: string, userId: number, payload: Record<string, unknown>) {
    const { cookie, csrfToken } = await logIn(app, email);
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${userId}/working-time`,
      headers: { cookie, origin: TEST_ORIGIN, 'x-csrf-token': csrfToken },
      payload,
    });
  }

  async function newMember(): Promise<number> {
    memberCount += 1;
    const id = await insertUser(db, {
      email: `member${memberCount}.time@example.com`,
      startDate: '2026-10-12',
    });
    await db.insertInto('teamMember').values({ teamId, userId: id }).execute();
    return id;
  }

  async function changesOf(userId: number) {
    return db
      .selectFrom('dailyMinutesChange')
      .select(['effectiveDate', 'previousDailyMinutes'])
      .where('userId', '=', userId)
      .orderBy('effectiveDate')
      .execute();
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const managerId = await insertUser(db, { email: MANAGER });
    teamId = await insertTeam(db, { name: 'Time team', managerId });
    await insertUser(db, { email: ADMIN, isAdmin: true });
    await insertUser(db, { email: 'outsider.time@example.com' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('changes the daily time from today, keeping past days', async () => {
    const memberId = await newMember();

    const response = await patch(MANAGER, memberId, { dailyMinutes: 360 });

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toMatchObject({
      workingTime: { dailyMinutes: 360, plannedChange: null },
    });
    expect(await changesOf(memberId)).toEqual([
      { effectiveDate: '2026-11-10', previousDailyMinutes: 420 },
    ]);
  });

  it('plans a change for a later date', async () => {
    const memberId = await newMember();

    const response = await patch(MANAGER, memberId, {
      dailyMinutes: 360,
      effectiveDate: '2026-11-16',
    });

    expect(response.json<unknown>()).toMatchObject({
      workingTime: {
        dailyMinutes: 420,
        plannedChange: { effectiveDate: '2026-11-16', dailyMinutes: 360 },
      },
    });
  });

  it('keeps the original previous value when the same date is edited again', async () => {
    const memberId = await newMember();
    await patch(MANAGER, memberId, { dailyMinutes: 360, effectiveDate: '2026-11-16' });

    await patch(MANAGER, memberId, { dailyMinutes: 300, effectiveDate: '2026-11-16' });

    expect(await changesOf(memberId)).toEqual([
      { effectiveDate: '2026-11-16', previousDailyMinutes: 420 },
    ]);
    const user = await db
      .selectFrom('appUser')
      .select('dailyMinutes')
      .where('id', '=', memberId)
      .executeTakeFirstOrThrow();
    expect(user.dailyMinutes).toBe(300);
  });

  it('refuses a date in the past', async () => {
    const memberId = await newMember();

    const response = await patch(MANAGER, memberId, {
      dailyMinutes: 360,
      effectiveDate: '2026-11-09',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('WORKING_TIME_DATE_IN_PAST');
  });

  it('serializes two edits for the same date: both succeed and the history keeps one row', async () => {
    const memberId = await newMember();

    const responses = await Promise.all([
      patch(MANAGER, memberId, { dailyMinutes: 360, effectiveDate: '2026-11-16' }),
      patch(ADMIN, memberId, { dailyMinutes: 300, effectiveDate: '2026-11-16' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(await changesOf(memberId)).toEqual([
      { effectiveDate: '2026-11-16', previousDailyMinutes: 420 },
    ]);
  });

  it('answers 404 for an archived person', async () => {
    const archivedId = await insertUser(db, {
      email: 'archived.time@example.com',
      isArchived: true,
    });

    expect((await patch(ADMIN, archivedId, { dailyMinutes: 360 })).statusCode).toBe(404);
  });

  it('refuses a date before a planned change', async () => {
    const memberId = await newMember();
    await patch(MANAGER, memberId, { dailyMinutes: 360, effectiveDate: '2026-11-23' });

    const response = await patch(MANAGER, memberId, {
      dailyMinutes: 300,
      effectiveDate: '2026-11-16',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('WORKING_TIME_CHANGE_ORDER');
  });

  it('lets an admin move the start date, never a manager', async () => {
    const memberId = await newMember();

    const byManager = await patch(MANAGER, memberId, { startDate: '2026-11-02' });
    const byAdmin = await patch(ADMIN, memberId, { startDate: '2026-11-02' });

    expect(byManager.statusCode).toBe(403);
    expect(byManager.json<{ code: string }>().code).toBe('WORKING_TIME_FORBIDDEN');
    expect(byAdmin.json<{ workingTime: { startDate: string } }>().workingTime.startDate).toBe(
      '2026-11-02',
    );
  });

  it('lets a manager change their own daily time', async () => {
    const managerId = (
      await db
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', MANAGER)
        .executeTakeFirstOrThrow()
    ).id;

    expect((await patch(MANAGER, managerId, { dailyMinutes: 450 })).statusCode).toBe(200);
  });

  it('refuses someone outside the scope', async () => {
    const memberId = await newMember();

    expect(
      (await patch('outsider.time@example.com', memberId, { dailyMinutes: 360 })).statusCode,
    ).toBe(403);
  });

  it('feeds the counters: the target uses the old value before the change and the new one after', async () => {
    const memberId = await newMember();
    await patch(MANAGER, memberId, { dailyMinutes: 360, effectiveDate: '2026-11-12' });
    const { cookie } = await logIn(app, MANAGER);

    const week = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${memberId}/clock-weeks/2026-W46`,
      headers: { cookie },
    });

    expect(
      week
        .json<{ days: { badgeableMinutes: number }[] }>()
        .days.map((day) => day.badgeableMinutes)
        .slice(0, 5),
    ).toEqual([420, 420, 420, 360, 360]);
  });
});
