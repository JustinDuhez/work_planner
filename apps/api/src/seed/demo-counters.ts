import { addDays, datesOfIsoWeek, isoWeekOf, toWorkDate } from '@work-planner/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/database';

const DAYS_PER_WEEK = 7;
const RESET_WEEKS_AGO = 2;
const RESET_OWNER_EMAIL = 'hugo.laurent@example.com';
const RESET_AUTHOR_EMAIL = 'sophie.dubois@example.com';
const PART_TIME_EMAIL = 'emma.lefebvre@example.com';
const PART_TIME_AUTHOR_EMAIL = 'nicolas.michel@example.com';
const PART_TIME_DAILY_MINUTES = 360;

async function idOfUser(db: Kysely<Database>, email: string): Promise<number> {
  const { id } = await db
    .selectFrom('appUser')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirstOrThrow();
  return id;
}

/**
 * Counting starts at the start date, which defaults to the account's creation day: the demo
 * history (seeded weeks back) would count nothing. Move it back to each person's first clock
 * day, but only while it is still that default — an admin's edit always wins.
 */
async function moveStartDatesToHistory(db: Kysely<Database>, timeZone: string): Promise<void> {
  await sql`
    UPDATE app_user
    SET start_date = history.first_work_date
    FROM (SELECT user_id, MIN(work_date) AS first_work_date FROM clock_day GROUP BY user_id) AS history
    WHERE history.user_id = app_user.id
      AND app_user.start_date = (app_user.created_at AT TIME ZONE ${timeZone})::date
      AND history.first_work_date < app_user.start_date
  `.execute(db);
}

async function seedResetIfMissing(db: Kysely<Database>, resetDate: string): Promise<void> {
  const ownerId = await idOfUser(db, RESET_OWNER_EMAIL);
  const existing = await db
    .selectFrom('counterReset')
    .select('id')
    .where('userId', '=', ownerId)
    .executeTakeFirst();
  const owner = await db
    .selectFrom('appUser')
    .select('startDate')
    .where('id', '=', ownerId)
    .executeTakeFirstOrThrow();
  if (existing || resetDate < owner.startDate) return;
  await db
    .insertInto('counterReset')
    .values({ userId: ownerId, resetDate, authorId: await idOfUser(db, RESET_AUTHOR_EMAIL) })
    .execute();
}

async function seedPartTimeIfMissing(db: Kysely<Database>, effectiveDate: string): Promise<void> {
  const person = await db
    .selectFrom('appUser')
    .select(['id', 'dailyMinutes'])
    .where('email', '=', PART_TIME_EMAIL)
    .executeTakeFirstOrThrow();
  const existing = await db
    .selectFrom('dailyMinutesChange')
    .select('id')
    .where('userId', '=', person.id)
    .executeTakeFirst();
  if (existing) return;
  const authorId = await idOfUser(db, PART_TIME_AUTHOR_EMAIL);
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('dailyMinutesChange')
      .values({
        userId: person.id,
        effectiveDate,
        previousDailyMinutes: person.dailyMinutes,
        authorId,
      })
      .execute();
    await trx
      .updateTable('appUser')
      .set({ dailyMinutes: PART_TIME_DAILY_MINUTES })
      .where('id', '=', person.id)
      .execute();
  });
}

export async function seedDemoCounters(
  db: Kysely<Database>,
  clock: { now: Date; timeZone: string },
): Promise<void> {
  const today = toWorkDate(clock.now, clock.timeZone);
  const [currentMonday] = datesOfIsoWeek(isoWeekOf(today)) ?? [];
  if (currentMonday === undefined) return;
  await moveStartDatesToHistory(db, clock.timeZone);
  await seedResetIfMissing(db, addDays(currentMonday, -RESET_WEEKS_AGO * DAYS_PER_WEEK));
  await seedPartTimeIfMissing(db, currentMonday);
}
