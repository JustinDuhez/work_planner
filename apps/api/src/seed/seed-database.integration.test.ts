import { sql, type Kysely } from 'kysely';
import { verifyPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';
import { createMigratedTestDb } from '../test/test-database';
import { DEMO_TEAMS, DEMO_USERS } from './demo-company';
import { seedDatabase, type SeedConfig } from './seed-database';

const SEED_CONFIG: SeedConfig = {
  adminEmail: 'admin@example.com',
  adminPassword: 'an admin passphrase',
  demoPassword: 'a demo passphrase',
};

describe('seedDatabase', () => {
  let db: Kysely<Database>;
  let firstRun: Awaited<ReturnType<typeof seedDatabase>>;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    firstRun = await seedDatabase(db, SEED_CONFIG);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates the admin and every demo person and team', () => {
    expect(firstRun.userCount).toBe(DEMO_USERS.length + 1);
    expect(firstRun.teamCount).toBe(DEMO_TEAMS.length);
  });

  it('changes nothing when it runs a second time', async () => {
    expect(await seedDatabase(db, SEED_CONFIG)).toEqual(firstRun);
  });

  it('never overwrites the admin password once the admin has changed it', async () => {
    await db
      .updateTable('appUser')
      .set({ passwordHash: 'changed-by-the-admin' })
      .where('email', '=', SEED_CONFIG.adminEmail)
      .execute();

    await seedDatabase(db, SEED_CONFIG);

    const admin = await db
      .selectFrom('appUser')
      .select(['passwordHash', 'isAdmin'])
      .where('email', '=', SEED_CONFIG.adminEmail)
      .executeTakeFirstOrThrow();
    expect(admin).toEqual({ passwordHash: 'changed-by-the-admin', isAdmin: true });
  });

  it('lets demo people log in with the demo password', async () => {
    const demoUser = await db
      .selectFrom('appUser')
      .select('passwordHash')
      .where('email', '=', 'lea.moreau@example.com')
      .executeTakeFirstOrThrow();

    await expect(verifyPassword(demoUser.passwordHash, SEED_CONFIG.demoPassword)).resolves.toBe(
      true,
    );
  });

  it('builds the nested team hierarchy', async () => {
    const front = await db
      .selectFrom('team as child')
      .innerJoin('team as parent', 'parent.id', 'child.parentTeamId')
      .innerJoin('appUser as manager', 'manager.id', 'child.managerId')
      .select(['parent.name as parentName', 'manager.email as managerEmail'])
      .where('child.name', '=', 'Front')
      .executeTakeFirstOrThrow();

    expect(front).toEqual({ parentName: 'Tech', managerEmail: 'sophie.dubois@example.com' });
  });

  it('includes an HR collaborator with the admin option, a blocked and an archived person', async () => {
    const special = await db
      .selectFrom('appUser')
      .select([
        'email',
        'isAdmin',
        'isBlocked',
        sql<boolean>`archived_at IS NOT NULL`.as('isArchived'),
      ])
      .where('email', 'in', [
        'ines.garcia@example.com',
        'lucas.fournier@example.com',
        'chloe.girard@example.com',
      ])
      .orderBy('email')
      .execute();

    expect(special).toEqual([
      { email: 'chloe.girard@example.com', isAdmin: false, isBlocked: false, isArchived: true },
      { email: 'ines.garcia@example.com', isAdmin: true, isBlocked: false, isArchived: false },
      { email: 'lucas.fournier@example.com', isAdmin: false, isBlocked: true, isArchived: false },
    ]);
  });

  it('puts one person in two teams', async () => {
    const teams = await db
      .selectFrom('teamMember')
      .innerJoin('team', 'team.id', 'teamMember.teamId')
      .innerJoin('appUser', 'appUser.id', 'teamMember.userId')
      .select('team.name')
      .where('appUser.email', '=', 'hugo.laurent@example.com')
      .orderBy('team.name')
      .execute();

    expect(teams.map((team) => team.name)).toEqual(['Back', 'Front']);
  });
});
