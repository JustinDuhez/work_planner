import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import {
  insertClockCorrection,
  insertCounterReset,
  insertTeam,
  insertUser,
} from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Monday 9 November 2026; W45 is last week.
const NOW = new Date('2026-11-09T10:00:00Z');
const RESPONDED_AT = new Date('2026-11-08T10:00:00Z');

interface WeekBody {
  days: {
    date: string;
    canCorrect: boolean;
    canClose: boolean;
    latestCorrection: { id: number; status: string } | null;
  }[];
  counters: { hasOpenRefusal: boolean; canViewCorrections: boolean };
}

describe('corrections in the week', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let managerId: number;
  let memberCount = 0;
  let teamId: number;

  async function newMember(): Promise<number> {
    memberCount += 1;
    const id = await insertUser(db, {
      email: `member${memberCount}.week@example.com`,
      startDate: '2026-10-19',
    });
    await db.insertInto('teamMember').values({ teamId, userId: id }).execute();
    return id;
  }

  async function weekOf(viewerEmail: string, ownerId: number, isoWeek = '2026-W45') {
    const { cookie } = await logIn(app, viewerEmail);
    return (
      await app.inject({
        method: 'GET',
        url: `/api/v1/users/${ownerId}/clock-weeks/${isoWeek}`,
        headers: { cookie },
      })
    ).json<WeekBody>();
  }

  function correction(
    userId: number,
    workDate: string,
    status: 'pending' | 'accepted' | 'refused' | 'superseded',
    createdAt: string,
  ) {
    const isAnswered = status === 'accepted' || status === 'refused';
    return insertClockCorrection(db, {
      userId,
      authorId: managerId,
      workDate,
      status,
      respondedAt: isAnswered ? RESPONDED_AT : null,
      createdAt: new Date(createdAt),
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    managerId = await insertUser(db, { email: 'manager.week@example.com' });
    teamId = await insertTeam(db, { name: 'Week corrections team', managerId });
    await insertUser(db, { email: 'colleague.week@example.com' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lets the manager correct every past day of the week, never today', async () => {
    const memberId = await newMember();

    const current = await weekOf('manager.week@example.com', memberId, '2026-W46');

    expect(current.days.map((day) => day.canCorrect)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(
      (await weekOf('manager.week@example.com', memberId)).days.every((day) => day.canCorrect),
    ).toBe(true);
  });

  it('never lets a colleague or the person correct', async () => {
    const memberId = await newMember();

    expect(
      (await weekOf('colleague.week@example.com', memberId)).days.some((day) => day.canCorrect),
    ).toBe(false);
  });

  it("shows each day's latest correction to the manager, hides it from a colleague", async () => {
    const memberId = await newMember();
    const pendingId = await correction(memberId, '2026-11-03', 'pending', '2026-11-04T09:00:00Z');

    const managerView = await weekOf('manager.week@example.com', memberId);
    const colleagueView = await weekOf('colleague.week@example.com', memberId);

    expect(managerView.days[1]?.latestCorrection).toEqual({ id: pendingId, status: 'pending' });
    expect(managerView.counters.canViewCorrections).toBe(true);
    expect(colleagueView.days[1]?.latestCorrection).toBeNull();
    expect(colleagueView.counters.canViewCorrections).toBe(false);
  });

  it('turns the counter red while a counted day was last refused, for every viewer', async () => {
    const memberId = await newMember();
    await correction(memberId, '2026-11-03', 'refused', '2026-11-04T09:00:00Z');

    expect((await weekOf('colleague.week@example.com', memberId)).counters.hasOpenRefusal).toBe(
      true,
    );
  });

  it('clears the red counter when a re-correction is accepted', async () => {
    const memberId = await newMember();
    await correction(memberId, '2026-11-03', 'refused', '2026-11-04T09:00:00Z');
    await correction(memberId, '2026-11-03', 'accepted', '2026-11-05T09:00:00Z');

    expect((await weekOf('manager.week@example.com', memberId)).counters.hasOpenRefusal).toBe(
      false,
    );
  });

  it('ignores a refusal on a day before the counter reset', async () => {
    const memberId = await newMember();
    await correction(memberId, '2026-11-03', 'refused', '2026-11-04T09:00:00Z');
    await insertCounterReset(db, {
      userId: memberId,
      resetDate: '2026-11-04',
      authorId: managerId,
    });

    expect((await weekOf('manager.week@example.com', memberId)).counters.hasOpenRefusal).toBe(
      false,
    );
  });

  it('offers the close of an unclosed day to its owner only', async () => {
    const memberId = await newMember();
    const dayId = await db
      .insertInto('clockDay')
      .values({ userId: memberId, workDate: '2026-11-05', workMode: 'on_site' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('clockPeriod')
      .values({ clockDayId: dayId.id, startedAt: new Date('2026-11-05T08:00:00Z'), endedAt: null })
      .execute();

    expect((await weekOf('manager.week@example.com', memberId)).days[3]).toMatchObject({
      canClose: false,
      canCorrect: true,
    });
  });
});
