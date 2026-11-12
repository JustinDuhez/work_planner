import { toWorkDate } from '@work-planner/domain';
import { sql, type Kysely } from 'kysely';
import { verifyPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';
import { createMigratedTestDb } from '../test/test-database';
import { DEMO_TEAMS, DEMO_USERS } from './demo-company';
import { seedDemoCorrections } from './demo-corrections';
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
    expect(firstRun.publicHolidayCount).toBe(22);
    expect(chloeDays).toEqual([]);
  });

  it('creates the demo leave requests once, on workable days only', async () => {
    const statuses = await db
      .selectFrom('leaveRequest')
      .innerJoin('appUser', 'appUser.id', 'leaveRequest.userId')
      .select(['appUser.email', 'leaveRequest.status'])
      .orderBy('appUser.email')
      .execute();

    expect(firstRun.leaveRequestCount).toBe(5);
    expect(statuses).toEqual(
      expect.arrayContaining([
        { email: 'lea.moreau@example.com', status: 'approved' },
        { email: 'hugo.laurent@example.com', status: 'pending' },
        { email: 'camille.simon@example.com', status: 'refused' },
        { email: 'emma.lefebvre@example.com', status: 'approved' },
        { email: 'emma.lefebvre@example.com', status: 'cancelled' },
      ]),
    );
  });

  it('never clocks demo hours on a day of approved absence', async () => {
    const emmaSickDay = await db
      .selectFrom('leaveRequest')
      .innerJoin('appUser', 'appUser.id', 'leaveRequest.userId')
      .innerJoin('dayType', 'dayType.id', 'leaveRequest.dayTypeId')
      .select('leaveRequest.startDate')
      .where('appUser.email', '=', 'emma.lefebvre@example.com')
      .where('dayType.code', '=', 'sick')
      .executeTakeFirstOrThrow();

    const clocked = await db
      .selectFrom('clockDay')
      .innerJoin('appUser', 'appUser.id', 'clockDay.userId')
      .select('clockDay.id')
      .where('appUser.email', '=', 'emma.lefebvre@example.com')
      .where('clockDay.workDate', '=', emmaSickDay.startDate)
      .execute();

    expect(clocked).toEqual([]);
  });

  it('never clocks demo hours on a public holiday', async () => {
    const clocked = await db
      .selectFrom('clockDay')
      .innerJoin('publicHoliday', 'publicHoliday.holidayDate', 'clockDay.workDate')
      .select('clockDay.id')
      .execute();

    expect(clocked).toEqual([]);
  });

  it('changes nothing when it runs a second time', async () => {
    expect(await seedDatabase(db, SEED_CONFIG, SEED_CLOCK)).toEqual(firstRun);
  });

  it('gives Léa a pending correction by Sophie and Camille a refused one by Thomas', async () => {
    const corrections = await db
      .selectFrom('clockCorrection')
      .innerJoin('appUser as owner', 'owner.id', 'clockCorrection.userId')
      .innerJoin('appUser as author', 'author.id', 'clockCorrection.authorId')
      .select([
        'owner.email as ownerEmail',
        'author.email as authorEmail',
        'clockCorrection.workDate',
        'clockCorrection.status',
        'clockCorrection.responseComment',
      ])
      .orderBy('owner.email')
      .execute();

    expect(corrections).toEqual([
      {
        ownerEmail: 'camille.simon@example.com',
        authorEmail: 'thomas.petit@example.com',
        workDate: '2026-10-26',
        status: 'refused',
        responseComment: "J'étais en déplacement ce jour-là.",
      },
      {
        ownerEmail: 'lea.moreau@example.com',
        authorEmail: 'sophie.dubois@example.com',
        workDate: '2026-10-27',
        status: 'pending',
        responseComment: null,
      },
    ]);
  });

  it("applies Léa's correction to her day: the afternoon ends 30 minutes later", async () => {
    const correction = await db
      .selectFrom('clockCorrection')
      .select(['beforePeriods', 'afterPeriods'])
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow();
    const lastBefore = correction.beforePeriods.at(-1);
    const lastAfter = correction.afterPeriods.at(-1);

    expect(
      new Date(lastAfter?.endedAt ?? 0).getTime() - new Date(lastBefore?.endedAt ?? 0).getTime(),
    ).toBe(30 * 60_000);
  });

  it("moves Camille's first period 15 minutes later", async () => {
    const correction = await db
      .selectFrom('clockCorrection')
      .select(['beforePeriods', 'afterPeriods'])
      .where('status', '=', 'refused')
      .executeTakeFirstOrThrow();

    expect(
      new Date(correction.afterPeriods[0]?.startedAt ?? 0).getTime() -
        new Date(correction.beforePeriods[0]?.startedAt ?? 0).getTime(),
    ).toBe(15 * 60_000);
  });

  it('notifies Léa (unread), Camille (read) and Thomas (unread)', async () => {
    const notifications = await db
      .selectFrom('notification')
      .innerJoin('appUser', 'appUser.id', 'notification.userId')
      .select([
        'appUser.email',
        'notification.type',
        sql<boolean>`notification.read_at IS NOT NULL`.as('isRead'),
      ])
      .orderBy('appUser.email')
      .execute();

    expect(notifications).toEqual([
      { email: 'camille.simon@example.com', type: 'clock_correction_received', isRead: true },
      { email: 'lea.moreau@example.com', type: 'clock_correction_received', isRead: false },
      { email: 'thomas.petit@example.com', type: 'clock_correction_answered', isRead: false },
    ]);
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

  it('seeds no correction for a person who has no clock day to correct', async () => {
    const people = ['lea.moreau@example.com', 'camille.simon@example.com'];
    const ids = db.selectFrom('appUser').select('id').where('email', 'in', people);
    await db.deleteFrom('notification').where('userId', 'in', ids).execute();
    await db.deleteFrom('clockCorrection').where('userId', 'in', ids).execute();
    await db
      .deleteFrom('clockDay')
      .where('userId', 'in', ids)
      .where('workDate', 'in', ['2026-10-26', '2026-10-27'])
      .execute();

    await seedDemoCorrections(db, SEED_CLOCK);
    const corrections = await db
      .selectFrom('clockCorrection')
      .select('id')
      .where('userId', 'in', ids)
      .execute();

    expect(corrections).toEqual([]);
  });

  describe('when the demo day cannot be corrected safely', () => {
    const at = (time: string): Date => new Date(`2026-10-${time}Z`);
    const ALL_DAY_CASES = [
      {
        name: 'Léa has an open last period',
        email: 'lea.moreau@example.com',
        date: '2026-10-27',
        periods: [{ startedAt: at('27T07:00:00'), endedAt: null }],
      },
      {
        name: 'Léa has no period',
        email: 'lea.moreau@example.com',
        date: '2026-10-27',
        periods: [],
      },
      {
        name: 'Léa last period ends at 23:45 so 30 more minutes pass midnight',
        email: 'lea.moreau@example.com',
        date: '2026-10-27',
        // 22:45Z is 23:45 in Paris (CET): 30 more minutes would pass midnight.
        periods: [{ startedAt: at('27T20:00:00'), endedAt: at('27T22:45:00') }],
      },
      {
        name: 'Camille has no period',
        email: 'camille.simon@example.com',
        date: '2026-10-26',
        periods: [],
      },
      {
        name: 'Camille has an open first period',
        email: 'camille.simon@example.com',
        date: '2026-10-26',
        periods: [{ startedAt: at('26T07:00:00'), endedAt: null }],
      },
      {
        name: 'Camille has a first period of 15 minutes',
        email: 'camille.simon@example.com',
        date: '2026-10-26',
        periods: [{ startedAt: at('26T07:00:00'), endedAt: at('26T07:15:00') }],
      },
    ];

    it.each(ALL_DAY_CASES)('skips the correction when $name', async ({ email, date, periods }) => {
      const user = await db
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirstOrThrow();
      await db.deleteFrom('notification').where('userId', '=', user.id).execute();
      await db.deleteFrom('clockCorrection').where('userId', '=', user.id).execute();
      await db
        .deleteFrom('clockDay')
        .where('userId', '=', user.id)
        .where('workDate', '=', date)
        .execute();
      const day = await db
        .insertInto('clockDay')
        .values({ userId: user.id, workDate: date, workMode: 'on_site' })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (periods.length > 0) {
        await db
          .insertInto('clockPeriod')
          .values(periods.map((period) => ({ clockDayId: day.id, ...period })))
          .execute();
      }

      await seedDemoCorrections(db, SEED_CLOCK);

      const corrections = await db
        .selectFrom('clockCorrection')
        .select('id')
        .where('userId', '=', user.id)
        .execute();
      expect(corrections).toEqual([]);
    });
  });
});

describe('seedDatabase on a database that already holds clocked history', () => {
  it('skips an approved absence on a day the person already clocked', async () => {
    const db = await createMigratedTestDb();
    try {
      await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);
      const emma = await db
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', 'emma.lefebvre@example.com')
        .executeTakeFirstOrThrow();
      const sick = await db
        .selectFrom('leaveRequest')
        .select(['id', 'startDate'])
        .where('userId', '=', emma.id)
        .where('status', '=', 'approved')
        .executeTakeFirstOrThrow();
      // Earlier seed runs predate leave: undo the sick day and clock that day instead.
      await db.deleteFrom('halfDay').where('leaveRequestId', '=', sick.id).execute();
      await db.deleteFrom('leaveRequest').where('id', '=', sick.id).execute();
      await db
        .insertInto('clockDay')
        .values({ userId: emma.id, workDate: sick.startDate })
        .onConflict((conflict) => conflict.doNothing())
        .execute();

      await seedDatabase(db, SEED_CONFIG, SEED_CLOCK);

      const approved = await db
        .selectFrom('leaveRequest')
        .select('id')
        .where('userId', '=', emma.id)
        .where('status', '=', 'approved')
        .execute();
      expect(approved).toEqual([]);
    } finally {
      await db.destroy();
    }
  });
});
