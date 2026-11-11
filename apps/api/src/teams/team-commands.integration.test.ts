import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

const ADMIN = 'ines.tc@example.com';
const MANAGER = 'sophie.tc@example.com';
const COLLEAGUE = 'lea.tc@example.com';

describe('team administration', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let sophieId: number;
  let leaId: number;
  let hugoId: number;
  let archivedId: number;
  let teamCount = 0;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function send(
    email: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    // One login per sender: the login route is rate-limited.
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method,
      url,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      ...(payload ? { payload } : {}),
    });
  }

  function uniqueName(): string {
    teamCount += 1;
    return `Équipe ${teamCount}`;
  }

  async function memberIdsOf(teamId: number): Promise<number[]> {
    const rows = await db
      .selectFrom('teamMember')
      .select('userId')
      .where('teamId', '=', teamId)
      .orderBy('userId')
      .execute();
    return rows.map((row) => row.userId);
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: ADMIN, isAdmin: true });
    sophieId = await insertUser(db, { email: MANAGER, firstName: 'Sophie' });
    leaId = await insertUser(db, { email: COLLEAGUE, firstName: 'Léa' });
    hugoId = await insertUser(db, { email: 'hugo.tc@example.com', firstName: 'Hugo' });
    archivedId = await insertUser(db, { email: 'chloe.tc@example.com', isArchived: true });
    await insertTeam(db, { name: 'Managed by Sophie', managerId: sophieId, memberIds: [leaId] });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock().now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  describe('who may manage', () => {
    it.each([
      ['a manager', MANAGER],
      ['a collaborator', COLLEAGUE],
    ])('refuses %s on every write', async (_who, email) => {
      const teamId = await insertTeam(db, { name: uniqueName() });

      const responses = [
        await send(email, 'POST', '/api/v1/teams', { name: uniqueName() }),
        await send(email, 'PATCH', `/api/v1/teams/${teamId}`, { name: uniqueName() }),
        await send(email, 'DELETE', `/api/v1/teams/${teamId}`),
      ];

      expect(responses.map((response) => response.statusCode)).toEqual([403, 403, 403]);
      expect(responses.map((response) => response.json<{ code: string }>().code)).toEqual(
        Array(3).fill('TEAM_MANAGEMENT_FORBIDDEN'),
      );
    });
  });

  describe('creating', () => {
    it('creates a team with a parent, a manager and members', async () => {
      const parentId = await insertTeam(db, { name: uniqueName() });
      const name = uniqueName();

      const response = await send(ADMIN, 'POST', '/api/v1/teams', {
        name,
        parentTeamId: parentId,
        managerId: sophieId,
        memberIds: [leaId, hugoId, leaId],
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<unknown>()).toMatchObject({
        name,
        parentTeamId: parentId,
        manager: { id: sophieId },
        members: [{ id: hugoId }, { id: leaId }],
      });
    });

    it('refuses a name already used', async () => {
      const name = uniqueName();
      await insertTeam(db, { name });

      const response = await send(ADMIN, 'POST', '/api/v1/teams', { name });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string }>().code).toBe('TEAM_NAME_TAKEN');
    });

    async function expectInvalidPerson(people: object, field: string) {
      const response = await send(ADMIN, 'POST', '/api/v1/teams', {
        name: uniqueName(),
        ...people,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ code: string; fieldErrors: Record<string, string> }>()).toMatchObject({
        code: 'TEAM_INVALID_PERSON',
        fieldErrors: { [field]: "Une des personnes choisies n'existe pas ou est archivée." },
      });
    }

    it('refuses an archived manager', async () => {
      await expectInvalidPerson({ managerId: archivedId }, 'managerId');
    });

    it('refuses an archived member', async () => {
      await expectInvalidPerson({ memberIds: [leaId, archivedId] }, 'memberIds');
    });

    it('refuses an unknown member', async () => {
      await expectInvalidPerson({ memberIds: [999999] }, 'memberIds');
    });

    it('answers 404 for an unknown parent', async () => {
      const response = await send(ADMIN, 'POST', '/api/v1/teams', {
        name: uniqueName(),
        parentTeamId: 999999,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json<{ code: string }>().code).toBe('TEAM_NOT_FOUND');
    });
  });

  describe('editing', () => {
    it('refuses to place a team under itself or under one of its sub-teams', async () => {
      const parentId = await insertTeam(db, { name: uniqueName() });
      const childId = await insertTeam(db, { name: uniqueName(), parentTeamId: parentId });
      const grandchildId = await insertTeam(db, { name: uniqueName(), parentTeamId: childId });

      const underItself = await send(ADMIN, 'PATCH', `/api/v1/teams/${parentId}`, {
        parentTeamId: parentId,
      });
      const underGrandchild = await send(ADMIN, 'PATCH', `/api/v1/teams/${parentId}`, {
        parentTeamId: grandchildId,
      });

      expect([underItself.statusCode, underGrandchild.statusCode]).toEqual([409, 409]);
      expect(underGrandchild.json<{ code: string }>().code).toBe('TEAM_CYCLE');
    });

    it('moves a team to the top level', async () => {
      const parentId = await insertTeam(db, { name: uniqueName() });
      const childId = await insertTeam(db, { name: uniqueName(), parentTeamId: parentId });

      const response = await send(ADMIN, 'PATCH', `/api/v1/teams/${childId}`, {
        parentTeamId: null,
      });

      expect(response.json<{ parentTeamId: number | null }>().parentTeamId).toBeNull();
    });

    it('never lets two concurrent moves close a loop', async () => {
      const firstId = await insertTeam(db, { name: uniqueName() });
      const secondId = await insertTeam(db, { name: uniqueName() });

      const responses = await Promise.all([
        send(ADMIN, 'PATCH', `/api/v1/teams/${firstId}`, { parentTeamId: secondId }),
        send(ADMIN, 'PATCH', `/api/v1/teams/${secondId}`, { parentTeamId: firstId }),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    });

    it('replaces the active members and keeps archived ones', async () => {
      const teamId = await insertTeam(db, { name: uniqueName(), memberIds: [leaId, archivedId] });

      const response = await send(ADMIN, 'PATCH', `/api/v1/teams/${teamId}`, {
        memberIds: [hugoId],
      });

      expect(response.json<{ members: { id: number }[] }>().members).toEqual([
        expect.objectContaining({ id: hugoId }),
      ]);
      expect(await memberIdsOf(teamId)).toEqual(
        [hugoId, archivedId].sort((first, second) => first - second),
      );
    });

    it('changes only the members when nothing else is sent', async () => {
      const teamId = await insertTeam(db, { name: uniqueName(), managerId: sophieId });

      const response = await send(ADMIN, 'PATCH', `/api/v1/teams/${teamId}`, {
        memberIds: [leaId],
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ manager: { id: number } }>().manager.id).toBe(sophieId);
    });

    it('clears the manager', async () => {
      const teamId = await insertTeam(db, { name: uniqueName(), managerId: sophieId });

      const response = await send(ADMIN, 'PATCH', `/api/v1/teams/${teamId}`, { managerId: null });

      expect(response.json<{ manager: unknown }>().manager).toBeNull();
    });

    it('gives a new manager rights over the members at once', async () => {
      // Hugo already sits in a team Sophie manages, so a fresh member shows the change.
      const newcomerId = await insertUser(db, { email: 'noa.tc@example.com', firstName: 'Noa' });
      const teamId = await insertTeam(db, { name: uniqueName(), memberIds: [newcomerId] });
      const before = await send(MANAGER, 'PATCH', `/api/v1/users/${newcomerId}/working-time`, {
        dailyMinutes: 400,
      });

      await send(ADMIN, 'PATCH', `/api/v1/teams/${teamId}`, { managerId: sophieId });
      const after = await send(MANAGER, 'PATCH', `/api/v1/users/${newcomerId}/working-time`, {
        dailyMinutes: 400,
      });

      expect([before.statusCode, after.statusCode]).toEqual([403, 200]);
    });

    it('answers 404 for an unknown team', async () => {
      expect(
        (await send(ADMIN, 'PATCH', '/api/v1/teams/999999', { name: uniqueName() })).statusCode,
      ).toBe(404);
    });
  });

  describe('deleting', () => {
    it('refuses while the team has sub-teams', async () => {
      const parentId = await insertTeam(db, { name: uniqueName() });
      await insertTeam(db, { name: uniqueName(), parentTeamId: parentId });

      const response = await send(ADMIN, 'DELETE', `/api/v1/teams/${parentId}`);

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string }>().code).toBe('TEAM_HAS_SUBTEAMS');
    });

    it('deletes the team and its memberships, not the people', async () => {
      const teamId = await insertTeam(db, { name: uniqueName(), memberIds: [leaId] });

      const response = await send(ADMIN, 'DELETE', `/api/v1/teams/${teamId}`);

      expect(response.statusCode).toBe(204);
      expect(await memberIdsOf(teamId)).toEqual([]);
      expect(
        await db.selectFrom('appUser').select('id').where('id', '=', leaId).executeTakeFirst(),
      ).toBeDefined();
    });

    it('answers 404 for an unknown team', async () => {
      expect((await send(ADMIN, 'DELETE', '/api/v1/teams/999999')).statusCode).toBe(404);
    });
  });
});
