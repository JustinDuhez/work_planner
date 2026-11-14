import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertLeaveRequest, insertPublicHoliday, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 13 November 2026.
const NOW = new Date('2026-11-13T09:00:00Z');

interface TeamMonthBody {
  month: { startDate: string; endDate: string };
  today: string;
  holidays: { date: string; label: string }[];
  teams: { id: number; path: string; managerId: number | null; memberIds: number[] }[];
  people: {
    id: number;
    teamIds: number[];
    halfDays: Record<string, unknown>[];
    balance: { globalGapMinutes: number; hasOpenRefusal: boolean };
  }[];
  canResetUserIds: number[];
  absentTodayUserIds: number[];
}

describe('the team month', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let sophieId: number;
  let leaId: number;
  let hugoId: number;
  let archivedId: number;
  let frontId: number;
  let claireId: number;

  async function get(email: string, url: string) {
    const { cookie } = await logIn(app, email);
    return app.inject({ method: 'GET', url, headers: { cookie } });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    claireId = await insertUser(db, { email: 'claire.tm@example.com' });
    sophieId = await insertUser(db, { email: 'sophie.tm@example.com' });
    leaId = await insertUser(db, { email: 'lea.tm@example.com', startDate: '2026-10-19' });
    hugoId = await insertUser(db, { email: 'hugo.tm@example.com' });
    await insertUser(db, { email: 'ines.tm@example.com', isAdmin: true });
    archivedId = await insertUser(db, { email: 'chloe.tm@example.com', isArchived: true });
    const techId = await insertTeam(db, { name: 'Tech', managerId: claireId });
    frontId = await insertTeam(db, {
      name: 'Front',
      parentTeamId: techId,
      managerId: sophieId,
      memberIds: [leaId, archivedId],
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      endDate: '2026-11-24',
      status: 'approved',
      reason: 'Mariage de ma sœur',
      reviewComment: 'Bon séjour',
    });
    await insertLeaveRequest(db, {
      userId: leaId,
      dayTypeCode: 'sick',
      startDate: '2026-10-30',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: sophieId,
      dayTypeCode: 'leave',
      startDate: '2026-11-13',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: claireId,
      dayTypeCode: 'telework',
      startDate: '2026-11-13',
      status: 'approved',
    });
    await insertLeaveRequest(db, {
      userId: hugoId,
      dayTypeCode: 'leave',
      startDate: '2026-11-13',
      status: 'pending',
    });
    await insertPublicHoliday(db, { date: '2026-11-11', label: 'Armistice' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('gives the month bounds, today, holidays and teams with paths', async () => {
    const body = (
      await get('hugo.tm@example.com', '/api/v1/team-months/2026-11')
    ).json<TeamMonthBody>();

    expect(body.month).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' });
    expect(body.today).toBe('2026-11-13');
    expect(body.holidays).toEqual([{ date: '2026-11-11', label: 'Armistice' }]);
    expect(body.teams.map((team) => team.path)).toEqual(['Tech', 'Tech › Front']);
    expect(body.teams[1]).toMatchObject({ id: frontId, managerId: sophieId, memberIds: [leaId] });
  });

  it("lists active people with the month's half-days only, never reasons or comments", async () => {
    const response = await get('hugo.tm@example.com', '/api/v1/team-months/2026-11');
    const body = response.json<TeamMonthBody>();
    const lea = body.people.find((person) => person.id === leaId);

    expect(body.people.some((person) => person.id === archivedId)).toBe(false);
    expect(lea?.teamIds).toEqual([frontId]);
    expect(lea?.halfDays).toHaveLength(4);
    expect(lea?.halfDays[0]).toEqual({
      date: '2026-11-23',
      half: 'am',
      dayTypeCode: 'leave',
      status: 'approved',
    });
    expect(response.body).not.toMatch(/Mariage|Bon séjour|reason|ruleNote|reviewComment/);
  });

  it("gives the same balance as the person's current week", async () => {
    const { cookie } = await logIn(app, 'hugo.tm@example.com');
    const week = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${leaId}/clock-weeks/2026-W46`,
      headers: { cookie },
    });
    const month = await app.inject({
      method: 'GET',
      url: '/api/v1/team-months/2026-11',
      headers: { cookie },
    });

    const expected = week.json<{
      counters: { globalGapMinutes: number; hasOpenRefusal: boolean };
    }>().counters;
    const lea = month.json<TeamMonthBody>().people.find((person) => person.id === leaId);
    expect(lea?.balance).toEqual({
      globalGapMinutes: expected.globalGapMinutes,
      hasOpenRefusal: expected.hasOpenRefusal,
    });
  });

  it.each([
    ['a collaborator', 'hugo.tm@example.com', () => []],
    [
      'a scope manager (self included)',
      'sophie.tm@example.com',
      () => [sophieId, leaId].sort((a, b) => a - b),
    ],
  ])('tells %s whom they may reset', async (_who, email, expected) => {
    const body = (await get(email, '/api/v1/team-months/2026-11')).json<TeamMonthBody>();

    expect([...body.canResetUserIds].sort((a, b) => a - b)).toEqual(expected());
  });

  it('lets an admin reset everyone', async () => {
    const body = (
      await get('ines.tm@example.com', '/api/v1/team-months/2026-11')
    ).json<TeamMonthBody>();

    expect(body.canResetUserIds).toHaveLength(body.people.length);
  });

  it.each(['2026-13', '1999-12', 'novembre'])('answers 400 for %s', async (yearMonth) => {
    const response = await get('hugo.tm@example.com', `/api/v1/team-months/${yearMonth}`);

    expect(response.statusCode).toBe(400);
  });

  it.each(['2026-11', '2026-12'])(
    "lists today's approved absences whichever month is asked (%s), not telework or pending",
    async (yearMonth) => {
      const body = (
        await get('hugo.tm@example.com', `/api/v1/team-months/${yearMonth}`)
      ).json<TeamMonthBody>();

      expect(body.today).toBe('2026-11-13');
      expect(body.absentTodayUserIds).toEqual([sophieId]);
    },
  );

  it('places Hugo in no team', async () => {
    const hugo = (await get('hugo.tm@example.com', '/api/v1/team-months/2026-11'))
      .json<TeamMonthBody>()
      .people.find((person) => person.id === hugoId);

    expect(hugo?.teamIds).toEqual([]);
  });
});
