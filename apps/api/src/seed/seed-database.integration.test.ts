import { toWorkDate } from '@work-planner/domain';
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

const SEED_CLOCK = { now: new Date('2026-11-06T09:30:00Z'), timeZone: 'Europe/Paris' };

describe('seedDatabase', () => {
  let db: Kysely<Database>;
  let firstRun: Awaited<ReturnType<typeof seedDatabase>>;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    firstRun = await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates the admin and every demo person and team', () => {
    expect(firstRun.userCount).toBe(DEMO_USERS.length + 1);
    expect(firstRun.teamCount).toBe(DEMO_TEAMS.length);
  });

  it('creates clock history for active people but not for archived ones', async () => {
    const chloe = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', 'chloe.girard@example.com')
      .executeTakeFirstOrThrow();
    const chloeDays = await db
      .selectFrom('clockDay')
      .select('id')
      .where('userId', '=', chloe.id)
      .execute();

    expect(firstRun.clockDayCount).toBeGreaterThan(0);
    expect(chloeDays).toEqual([]);
  });

  it('changes nothing when it runs a second time', async () => {
    expect(await seedDatabase(db, SEED_CONFIG, SEED_CLOCK)).toEqual(firstRun);
  });

  it("moves demo people's start date back to the start of their clock history", async () => {
    const lea = await db
      .selectFrom('appUser')
      .select('startDate')
      .where('email', '=', 'lea.moreau@example.com')
      .executeTakeFirstOrThrow();

    expect(lea.startDate).toBe('2026-10-12');
  });

  it('never moves a start date an admin has already changed', async () => {
    await db
      .updateTable('appUser')
      .set({ startDate: '2026-11-02' })
      .where('email', '=', 'camille.simon@example.com')
      .execute();

    await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);

    const camille = await db
      .selectFrom('appUser')
      .select('startDate')
      .where('email', '=', 'camille.simon@example.com')
      .executeTakeFirstOrThrow();
    expect(camille.startDate).toBe('2026-11-02');
  });

  it("moves an existing account's default start date back to its first clock day", async () => {
    const thomas = await db
      .selectFrom('appUser')
      .select(['id', 'createdAt'])
      .where('email', '=', 'thomas.petit@example.com')
      .executeTakeFirstOrThrow();
    const creationDay = toWorkDate(thomas.createdAt, 'Europe/Paris');
    await db
      .updateTable('appUser')
      .set({ startDate: creationDay })
      .where('id', '=', thomas.id)
      .execute();

    await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);

    const after = await db
      .selectFrom('appUser')
      .select('startDate')
      .where('id', '=', thomas.id)
      .executeTakeFirstOrThrow();
    expect(after.startDate).toBe('2026-10-12');
  });

  it('gives Hugo one reset by his manager and Emma one daily-time change', async () => {
    const resets = await db
      .selectFrom('counterReset')
      .innerJoin('appUser as owner', 'owner.id', 'counterReset.userId')
      .innerJoin('appUser as author', 'author.id', 'counterReset.authorId')
      .select([
        'owner.email as ownerEmail',
        'author.email as authorEmail',
        'counterReset.resetDate',
      ])
      .execute();
    const emma = await db
      .selectFrom('appUser')
      .select(['id', 'dailyMinutes'])
      .where('email', '=', 'emma.lefebvre@example.com')
      .executeTakeFirstOrThrow();
    const changes = await db
      .selectFrom('dailyMinutesChange')
      .select(['effectiveDate', 'previousDailyMinutes'])
      .where('userId', '=', emma.id)
      .execute();

    expect(resets).toEqual([
      {
        ownerEmail: 'hugo.laurent@example.com',
        authorEmail: 'sophie.dubois@example.com',
        resetDate: '2026-10-19',
      },
    ]);
    expect(emma.dailyMinutes).toBe(360);
    expect(changes).toEqual([{ effectiveDate: '2026-11-02', previousDailyMinutes: 420 }]);
  });

  it('never overwrites the admin password once the admin has changed it', async () => {
    await db
      .updateTable('appUser')
      .set({ passwordHash: 'changed-by-the-admin' })
      .where('email', '=', SEED_CONFIG.adminEmail)
      .execute();

    await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);

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

  it('gives nobody a reset dated before their start date', async () => {
    const hugo = await db
      .selectFrom('appUser')
      .select('id')
      .where('email', '=', 'hugo.laurent@example.com')
      .executeTakeFirstOrThrow();
    await db.deleteFrom('counterReset').where('userId', '=', hugo.id).execute();
    await db
      .updateTable('appUser')
      .set({ startDate: toWorkDate(SEED_CLOCK.now, SEED_CLOCK.timeZone) })
      .where('id', '=', hugo.id)
      .execute();

    await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);

    const resets = await db
      .selectFrom('counterReset')
      .select('id')
      .where('userId', '=', hugo.id)
      .execute();
    expect(resets).toEqual([]);
  });
});
