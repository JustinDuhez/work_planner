import type { Kysely } from 'kysely';
import { hashPassword } from '../auth/password-hasher';
import type { Database } from '../db/database';

export const DEFAULT_TEST_PASSWORD = 'correct horse battery staple';

export interface TestUser {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  isAdmin?: boolean;
  isBlocked?: boolean;
  isArchived?: boolean;
  dailyMinutes?: number;
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
