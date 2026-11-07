import type { Kysely } from 'kysely';
import { hashPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';
import { buildDemoClockHistory } from './demo-clock-history';
import { DEMO_TEAMS, DEMO_USERS, type DemoUser } from './demo-company';
import type { SeedConfig } from './seed-config';

export type { SeedConfig } from './seed-config';

async function insertUserIfMissing(
  db: Kysely<Database>,
  user: DemoUser,
  passwordHash: string,
): Promise<void> {
  // DO NOTHING (not an upsert): data changed in the app, e.g. a new password, survives a re-run.
  await db
    .insertInto('appUser')
    .values({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      passwordHash,
      isAdmin: user.isAdmin ?? false,
      isBlocked: user.isBlocked ?? false,
      archivedAt: user.isArchived ? new Date() : null,
    })
    .onConflict((conflict) => conflict.column('email').doNothing())
    .execute();
}

async function idOfUser(db: Kysely<Database>, email: string): Promise<number> {
  const { id } = await db
    .selectFrom('appUser')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirstOrThrow();
  return id;
}

async function idOfTeam(db: Kysely<Database>, name: string): Promise<number> {
  const { id } = await db
    .selectFrom('team')
    .select('id')
    .where('name', '=', name)
    .executeTakeFirstOrThrow();
  return id;
}

async function countRows(
  db: Kysely<Database>,
  table: 'appUser' | 'team' | 'teamMember' | 'clockDay',
): Promise<number> {
  const { count } = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirstOrThrow();
  return Number(count);
}

export async function seedDatabase(
  db: Kysely<Database>,
  config: SeedConfig,
  clock: { now: Date; timeZone: string },
): Promise<{
  userCount: number;
  teamCount: number;
  membershipCount: number;
  clockDayCount: number;
}> {
  await insertUserIfMissing(
    db,
    { email: config.adminEmail, firstName: 'Admin', lastName: 'Work Planner', isAdmin: true },
    await hashPassword(config.adminPassword),
  );
  const demoPasswordHash = await hashPassword(config.demoPassword);
  for (const user of DEMO_USERS) {
    await insertUserIfMissing(db, user, demoPasswordHash);
  }
  for (const team of DEMO_TEAMS) {
    await db
      .insertInto('team')
      .values({
        name: team.name,
        parentTeamId: team.parentName ? await idOfTeam(db, team.parentName) : null,
        managerId: await idOfUser(db, team.managerEmail),
      })
      .onConflict((conflict) => conflict.column('name').doNothing())
      .execute();
    const teamId = await idOfTeam(db, team.name);
    for (const memberEmail of team.memberEmails) {
      await db
        .insertInto('teamMember')
        .values({ teamId, userId: await idOfUser(db, memberEmail) })
        .onConflict((conflict) => conflict.columns(['teamId', 'userId']).doNothing())
        .execute();
    }
  }
  const activeEmails = DEMO_USERS.filter((user) => !user.isArchived).map((user) => user.email);
  for (const day of buildDemoClockHistory({
    now: clock.now,
    timeZone: clock.timeZone,
    emails: activeEmails,
  })) {
    const userId = await idOfUser(db, day.email);
    // One transaction per day: a crash must not leave a day without periods, which the
    // DO NOTHING below would never repair.
    await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('clockDay')
        .values({ userId, workDate: day.workDate, workMode: day.workMode })
        .onConflict((conflict) => conflict.columns(['userId', 'workDate']).doNothing())
        .returning('id')
        .executeTakeFirst();
      // An existing day is left exactly as it is (it may have been changed in the app).
      if (!inserted) return;
      for (const period of day.periods) {
        await trx
          .insertInto('clockPeriod')
          .values({ clockDayId: inserted.id, ...period })
          .execute();
      }
    });
  }
  return {
    userCount: await countRows(db, 'appUser'),
    teamCount: await countRows(db, 'team'),
    membershipCount: await countRows(db, 'teamMember'),
    clockDayCount: await countRows(db, 'clockDay'),
  };
}
