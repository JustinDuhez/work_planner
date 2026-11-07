import { sql, type Kysely } from 'kysely';
import { insertClockDay, insertClockPeriod, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import type { Database } from './database';

describe('clock schema', () => {
  let db: Kysely<Database>;
  let userCount = 0;

  async function newDay(): Promise<number> {
    userCount += 1;
    const userId = await insertUser(db, { email: `clock.schema${userCount}@example.com` });
    return insertClockDay(db, { userId, workDate: '2026-11-06' });
  }

  function at(time: string): Date {
    return new Date(`2026-11-06T${time}:00Z`);
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('runs every database session in UTC, whatever the server is configured with', async () => {
    const { rows } = await sql<{
      timeZone: string;
    }>`SELECT current_setting('TimeZone') AS time_zone`.execute(db);

    expect(rows[0]?.timeZone).toBe('UTC');
  });

  it('gives a new day the on-site mode', async () => {
    const dayId = await newDay();

    const day = await db
      .selectFrom('clockDay')
      .select('workMode')
      .where('id', '=', dayId)
      .executeTakeFirstOrThrow();
    expect(day.workMode).toBe('on_site');
  });

  it('refuses a second day row for the same person and date', async () => {
    const dayId = await newDay();
    const { userId } = await db
      .selectFrom('clockDay')
      .select('userId')
      .where('id', '=', dayId)
      .executeTakeFirstOrThrow();

    await expect(insertClockDay(db, { userId, workDate: '2026-11-06' })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('refuses an unknown work mode', async () => {
    const userId = await insertUser(db, { email: 'clock.mode@example.com' });

    await expect(
      sql`INSERT INTO clock_day (user_id, work_date, work_mode) VALUES (${userId}, '2026-11-06', 'beach')`.execute(
        db,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a second open period on the same day', async () => {
    const clockDayId = await newDay();
    await insertClockPeriod(db, { clockDayId, startedAt: at('08:00') });

    await expect(
      insertClockPeriod(db, { clockDayId, startedAt: at('12:00') }),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'clock_period_one_open_per_day',
    });
  });

  it('refuses overlapping periods even when the application is bypassed', async () => {
    const clockDayId = await newDay();
    await insertClockPeriod(db, { clockDayId, startedAt: at('08:00'), endedAt: at('11:00') });

    await expect(
      insertClockPeriod(db, { clockDayId, startedAt: at('10:00'), endedAt: at('12:00') }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('accepts back-to-back periods', async () => {
    const clockDayId = await newDay();
    await insertClockPeriod(db, { clockDayId, startedAt: at('08:00'), endedAt: at('11:00') });

    await expect(
      insertClockPeriod(db, { clockDayId, startedAt: at('11:00'), endedAt: at('12:00') }),
    ).resolves.toEqual(expect.any(Number));
  });

  it('refuses an end that is not after the start', async () => {
    const clockDayId = await newDay();

    await expect(
      insertClockPeriod(db, { clockDayId, startedAt: at('11:00'), endedAt: at('11:00') }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses times with seconds: time is counted to the minute', async () => {
    const clockDayId = await newDay();

    await expect(
      insertClockPeriod(db, { clockDayId, startedAt: new Date('2026-11-06T08:00:30Z') }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it("deletes a day's periods with the day", async () => {
    const clockDayId = await newDay();
    await insertClockPeriod(db, { clockDayId, startedAt: at('08:00'), endedAt: at('09:00') });

    await db.deleteFrom('clockDay').where('id', '=', clockDayId).execute();

    const remaining = await db
      .selectFrom('clockPeriod')
      .select('id')
      .where('clockDayId', '=', clockDayId)
      .execute();
    expect(remaining).toEqual([]);
  });
});
