import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertDailyMinutesChange, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Tuesday 10 November 2026.
const NOW = new Date('2026-11-10T09:00:00Z');

interface Entry {
  id: number;
  email: string;
  firstName: string;
  isManager: boolean;
  isBlocked: boolean;
  isArchived: boolean;
  teams: { name: string }[];
  managers: { firstName: string }[];
  canManage: boolean;
  canEditWorkingTime: boolean;
  workingTime: { dailyMinutes: number; startDate: string; plannedChange: unknown } | null;
}

describe('the directory', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let leaId: number;
  let managerId: number;

  async function list(email: string, query = '') {
    const { cookie } = await logIn(app, email);
    return app.inject({ method: 'GET', url: `/api/v1/users${query}`, headers: { cookie } });
  }

  function byName(entries: Entry[], firstName: string): Entry {
    const entry = entries.find((candidate) => candidate.firstName === firstName);
    if (!entry) throw new Error(`No ${firstName}`);
    return entry;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    managerId = await insertUser(db, {
      email: 'sophie.dir@example.com',
      firstName: 'Sophie',
      lastName: 'Dubois',
    });
    const directorId = await insertUser(db, {
      email: 'claire.dir@example.com',
      firstName: 'Claire',
      lastName: 'Martin',
    });
    leaId = await insertUser(db, {
      email: 'lea.dir@example.com',
      firstName: 'Léa',
      lastName: 'Moreau',
      startDate: '2026-10-12',
    });
    await insertUser(db, {
      email: 'lucas.dir@example.com',
      firstName: 'Lucas',
      lastName: 'Fournier',
      isBlocked: true,
    });
    await insertUser(db, {
      email: 'chloe.dir@example.com',
      firstName: 'Chloé',
      lastName: 'Girard',
      isArchived: true,
    });
    await insertUser(db, { email: 'hugo.dir@example.com', firstName: 'Hugo', lastName: 'Laurent' });
    await insertUser(db, {
      email: 'ines.dir@example.com',
      firstName: 'Inès',
      lastName: 'Garcia',
      isAdmin: true,
    });
    const directionId = await insertTeam(db, { name: 'Direction', managerId: directorId });
    await insertTeam(db, {
      name: 'Front',
      parentTeamId: directionId,
      managerId,
      memberIds: [leaId],
    });
    await insertDailyMinutesChange(db, {
      userId: leaId,
      effectiveDate: '2026-11-16',
      previousDailyMinutes: 420,
      authorId: managerId,
    });
    await db.updateTable('appUser').set({ dailyMinutes: 360 }).where('id', '=', leaId).execute();
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists every active person with email, teams and managers, blocked included', async () => {
    const entries = (await list('lea.dir@example.com')).json<Entry[]>();

    expect(entries.map((entry) => entry.firstName)).toEqual([
      'Sophie',
      'Lucas',
      'Inès',
      'Hugo',
      'Claire',
      'Léa',
    ]);
    expect(byName(entries, 'Léa')).toMatchObject({
      email: 'lea.dir@example.com',
      teams: [{ name: 'Front' }],
      managers: [{ firstName: 'Sophie' }],
    });
    expect(byName(entries, 'Sophie')).toMatchObject({
      isManager: true,
      managers: [{ firstName: 'Claire' }],
    });
    expect(byName(entries, 'Lucas').isBlocked).toBe(true);
  });

  it('shows working time only to whoever may edit it', async () => {
    const asColleague = (await list('hugo.dir@example.com')).json<Entry[]>();
    const asManager = (await list('sophie.dir@example.com')).json<Entry[]>();

    expect(byName(asColleague, 'Léa')).toMatchObject({
      canEditWorkingTime: false,
      workingTime: null,
      canManage: false,
    });
    expect(byName(asManager, 'Léa')).toMatchObject({
      canEditWorkingTime: true,
      workingTime: {
        dailyMinutes: 420,
        startDate: '2026-10-12',
        plannedChange: { effectiveDate: '2026-11-16', dailyMinutes: 360 },
      },
    });
  });

  it('lets an admin manage everyone', async () => {
    const entries = (await list('ines.dir@example.com')).json<Entry[]>();

    expect(entries.every((entry) => entry.canManage)).toBe(true);
  });

  it('lists archived people for an admin only', async () => {
    const archived = (await list('ines.dir@example.com', '?archived=true')).json<Entry[]>();
    const refused = await list('lea.dir@example.com', '?archived=true');

    expect(archived.map((entry) => entry.firstName)).toEqual(['Chloé']);
    expect(archived[0]?.isArchived).toBe(true);
    expect(refused.statusCode).toBe(403);
    expect(refused.json<{ code: string }>().code).toBe('USER_MANAGEMENT_FORBIDDEN');
  });

  it('never sends password hashes', async () => {
    const body = (await list('ines.dir@example.com')).body;

    expect(body).not.toMatch(/argon2|passwordHash/);
  });
});
