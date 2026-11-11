import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

interface Team {
  name: string;
  parentTeamId: number | null;
  manager: { firstName: string } | null;
  members: { firstName: string }[];
  canManage: boolean;
}

describe('the team list', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let directionId: number;

  async function list(email: string): Promise<Team[]> {
    const { cookie } = await logIn(app, email);
    return (await app.inject({ method: 'GET', url: '/api/v1/teams', headers: { cookie } })).json<
      Team[]
    >();
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const claire = await insertUser(db, { email: 'claire.team@example.com', firstName: 'Claire' });
    const sophie = await insertUser(db, { email: 'sophie.team@example.com', firstName: 'Sophie' });
    const lea = await insertUser(db, {
      email: 'lea.team@example.com',
      firstName: 'Léa',
      lastName: 'Moreau',
    });
    const hugo = await insertUser(db, {
      email: 'hugo.team@example.com',
      firstName: 'Hugo',
      lastName: 'Laurent',
    });
    const chloe = await insertUser(db, {
      email: 'chloe.team@example.com',
      firstName: 'Chloé',
      isArchived: true,
    });
    await insertUser(db, { email: 'ines.team@example.com', isAdmin: true });
    directionId = await insertTeam(db, { name: 'Direction', managerId: claire });
    await insertTeam(db, {
      name: 'Front',
      parentTeamId: directionId,
      managerId: sophie,
      memberIds: [lea, hugo, chloe],
    });
    await insertTeam(db, { name: 'Archives', managerId: chloe });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock().now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists every team by name with parent, manager and active members', async () => {
    const teams = await list('lea.team@example.com');

    expect(teams.map((team) => team.name)).toEqual(['Archives', 'Direction', 'Front']);
    expect(teams[2]).toMatchObject({
      parentTeamId: directionId,
      manager: { firstName: 'Sophie' },
      members: [{ firstName: 'Hugo' }, { firstName: 'Léa' }],
      canManage: false,
    });
  });

  it('shows no manager when the manager is archived', async () => {
    const teams = await list('lea.team@example.com');

    expect(teams[0]?.manager).toBeNull();
  });

  it('lets only an admin manage teams', async () => {
    const teams = await list('ines.team@example.com');

    expect(teams.every((team) => team.canManage)).toBe(true);
  });
});
