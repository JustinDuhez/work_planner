import type { Kysely } from 'kysely';
import { hashPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';
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
  table: 'appUser' | 'team' | 'teamMember',
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
): Promise<{ userCount: number; teamCount: number; membershipCount: number }> {
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
  return {
    userCount: await countRows(db, 'appUser'),
    teamCount: await countRows(db, 'team'),
    membershipCount: await countRows(db, 'teamMember'),
  };
}
