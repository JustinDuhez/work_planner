import type { WorkMode } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import { hashPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';

export const DEFAULT_TEST_PASSWORD = 'correct horse battery staple';

// The Monday of the test clock's week (createTestClock defaults to Friday 2026-11-06).
const DEFAULT_TEST_START_DATE = '2026-11-02';

export interface TestUser {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  isAdmin?: boolean;
  isBlocked?: boolean;
  isArchived?: boolean;
  dailyMinutes?: number;
  startDate?: string;
}

export interface TestTeam {
  name: string;
  parentTeamId?: number;
  managerId?: number;
  memberIds?: number[];
}

export async function insertUser(db: Kysely<Database>, user: TestUser): Promise<number> {
  const { id } = await db
    .insertInto('appUser')
    .values({
      email: user.email,
      firstName: user.firstName ?? 'Test',
      lastName: user.lastName ?? 'User',
      passwordHash: await hashPassword(user.password ?? DEFAULT_TEST_PASSWORD),
      isAdmin: user.isAdmin ?? false,
      isBlocked: user.isBlocked ?? false,
      archivedAt: user.isArchived ? new Date() : null,
      dailyMinutes: user.dailyMinutes,
      startDate: user.startDate ?? DEFAULT_TEST_START_DATE,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertTeam(db: Kysely<Database>, team: TestTeam): Promise<number> {
  const { id } = await db
    .insertInto('team')
    .values({
      name: team.name,
      parentTeamId: team.parentTeamId ?? null,
      managerId: team.managerId ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const userId of team.memberIds ?? []) {
    await db.insertInto('teamMember').values({ teamId: id, userId }).execute();
  }
  return id;
}

export async function insertClockDay(
  db: Kysely<Database>,
  day: { userId: number; workDate: string; workMode?: WorkMode },
): Promise<number> {
  const { id } = await db
    .insertInto('clockDay')
    .values({ userId: day.userId, workDate: day.workDate, workMode: day.workMode })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertClockPeriod(
  db: Kysely<Database>,
  period: { clockDayId: number; startedAt: Date; endedAt?: Date | null },
): Promise<number> {
  const { id } = await db
    .insertInto('clockPeriod')
    .values({
      clockDayId: period.clockDayId,
      startedAt: period.startedAt,
      endedAt: period.endedAt ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertCounterReset(
  db: Kysely<Database>,
  reset: { userId: number; resetDate: string; authorId: number; createdAt?: Date },
): Promise<number> {
  const { id } = await db
    .insertInto('counterReset')
    .values({
      userId: reset.userId,
      resetDate: reset.resetDate,
      authorId: reset.authorId,
      createdAt: reset.createdAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertDailyMinutesChange(
  db: Kysely<Database>,
  change: { userId: number; effectiveDate: string; previousDailyMinutes: number; authorId: number },
): Promise<number> {
  const { id } = await db
    .insertInto('dailyMinutesChange')
    .values(change)
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}
