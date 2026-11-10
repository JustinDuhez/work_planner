import {
  computeSessionExpiry,
  isSessionActive,
  SESSION_IDLE_TIMEOUT_IN_MILLISECONDS,
  shouldRefreshActivity,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { generateSecretToken, hashToken } from './session-token';

export interface AuthDependencies {
  db: Kysely<Database>;
  now: () => Date;
}

export interface SessionUser {
  id: number;
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export interface ResolvedSession {
  sessionId: number;
  csrfToken: string;
  user: SessionUser;
}

export async function createSession(
  { db, now }: AuthDependencies,
  userId: number,
): Promise<{ token: string; csrfToken: string }> {
  const token = generateSecretToken();
  const csrfToken = generateSecretToken();
  const createdAt = now();
  await db
    .insertInto('session')
    .values({
      tokenHash: hashToken(token),
      userId,
      csrfToken,
      lastSeenAt: createdAt,
      expiresAt: computeSessionExpiry(createdAt),
    })
    .execute();
  return { token, csrfToken };
}

export async function resolveSession(
  { db, now }: AuthDependencies,
  token: string,
): Promise<ResolvedSession | null> {
  const row = await db
    .selectFrom('session')
    .innerJoin('appUser', 'appUser.id', 'session.userId')
    .select([
      'session.id as sessionId',
      'session.csrfToken',
      'session.lastSeenAt',
      'session.expiresAt',
      'appUser.id as userId',
      'appUser.isAdmin',
      'appUser.isBlocked',
      'appUser.mustChangePassword',
      'appUser.archivedAt',
    ])
    .where('session.tokenHash', '=', hashToken(token))
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  const currentTime = now();
  const isUsable = isSessionActive(row, currentTime) && !row.isBlocked && row.archivedAt === null;
  if (!isUsable) {
    await db.deleteFrom('session').where('id', '=', row.sessionId).execute();
    return null;
  }
  if (shouldRefreshActivity(row.lastSeenAt, currentTime)) {
    await db
      .updateTable('session')
      .set({ lastSeenAt: currentTime })
      .where('id', '=', row.sessionId)
      .execute();
  }
  return {
    sessionId: row.sessionId,
    csrfToken: row.csrfToken,
    user: { id: row.userId, isAdmin: row.isAdmin, mustChangePassword: row.mustChangePassword },
  };
}

export async function deleteSession({ db }: AuthDependencies, token: string): Promise<void> {
  await db.deleteFrom('session').where('tokenHash', '=', hashToken(token)).execute();
}

export async function deleteOtherSessions(
  { db }: AuthDependencies,
  userId: number,
  keptSessionId: number,
): Promise<void> {
  await db
    .deleteFrom('session')
    .where('userId', '=', userId)
    .where('id', '<>', keptSessionId)
    .execute();
}

export async function deleteAllSessions(db: Kysely<Database>, userId: number): Promise<void> {
  await db.deleteFrom('session').where('userId', '=', userId).execute();
}

/** E1 carry-forward: dead rows would otherwise pile up forever. */
export async function purgeExpiredSessions({ db, now }: AuthDependencies): Promise<void> {
  const currentTime = now();
  const idleLimit = new Date(currentTime.getTime() - SESSION_IDLE_TIMEOUT_IN_MILLISECONDS);
  await db
    .deleteFrom('session')
    .where((eb) => eb.or([eb('expiresAt', '<=', currentTime), eb('lastSeenAt', '<=', idleLimit)]))
    .execute();
}
