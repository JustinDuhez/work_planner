import {
  SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS,
  SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS,
  SESSION_IDLE_TIMEOUT_IN_MILLISECONDS,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { insertUser } from '../test/fixtures';
import { createTestClock, type TestClock } from '../test/test-clock';
import { createMigratedTestDb } from '../test/test-database';
import {
  createSession,
  deleteOtherSessions,
  deleteSession,
  resolveSession,
  type AuthDependencies,
} from './session-service';
import { hashToken } from './session-token';

const ONE_MINUTE_IN_MILLISECONDS = 60_000;
const SIX_HOURS_IN_MILLISECONDS = 6 * 60 * ONE_MINUTE_IN_MILLISECONDS;

describe('session service', () => {
  let db: Kysely<Database>;
  let clock: TestClock;
  let deps: AuthDependencies;
  let userCount = 0;

  async function newUser(overrides: { isAdmin?: boolean } = {}): Promise<number> {
    userCount += 1;
    return insertUser(db, { email: `session.user${userCount}@example.com`, ...overrides });
  }

  async function countSessions(userId: number): Promise<number> {
    const rows = await db.selectFrom('session').select('id').where('userId', '=', userId).execute();
    return rows.length;
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  beforeEach(() => {
    clock = createTestClock();
    deps = { db, now: clock.now };
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('resolves a fresh session to its user and CSRF token', async () => {
    const userId = await newUser({ isAdmin: true });
    const { token, csrfToken } = await createSession(deps, userId);

    const session = await resolveSession(deps, token);

    expect(session).toEqual({
      sessionId: expect.any(Number) as number,
      csrfToken,
      user: { id: userId, isAdmin: true, mustChangePassword: false },
    });
  });

  it('stores only the hash of the token', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    const stored = await db
      .selectFrom('session')
      .select('tokenHash')
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    expect(stored.tokenHash).toBe(hashToken(token));
  });

  it('does not resolve an unknown token', async () => {
    expect(await resolveSession(deps, 'not-a-real-token')).toBeNull();
  });

  it('ends a session after eight hours without activity and deletes it', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    clock.advanceBy(SESSION_IDLE_TIMEOUT_IN_MILLISECONDS);

    expect(await resolveSession(deps, token)).toBeNull();
    expect(await countSessions(userId)).toBe(0);
  });

  it('keeps an active session alive past eight hours', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    clock.advanceBy(SIX_HOURS_IN_MILLISECONDS);
    await resolveSession(deps, token);
    clock.advanceBy(SIX_HOURS_IN_MILLISECONDS);

    expect(await resolveSession(deps, token)).not.toBeNull();
  });

  it('ends a session after seven days even if the user is active every few hours', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    let elapsedInMilliseconds = 0;
    while (
      elapsedInMilliseconds + SIX_HOURS_IN_MILLISECONDS <
      SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS
    ) {
      clock.advanceBy(SIX_HOURS_IN_MILLISECONDS);
      elapsedInMilliseconds += SIX_HOURS_IN_MILLISECONDS;
      expect(await resolveSession(deps, token)).not.toBeNull();
    }
    clock.advanceBy(SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS - elapsedInMilliseconds);

    expect(await resolveSession(deps, token)).toBeNull();
  });

  it('refreshes last activity at most every five minutes', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);
    const readLastSeen = async () =>
      (
        await db
          .selectFrom('session')
          .select('lastSeenAt')
          .where('userId', '=', userId)
          .executeTakeFirstOrThrow()
      ).lastSeenAt.getTime();
    const createdAt = await readLastSeen();

    clock.advanceBy(ONE_MINUTE_IN_MILLISECONDS);
    await resolveSession(deps, token);
    expect(await readLastSeen()).toBe(createdAt);

    clock.advanceBy(SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS);
    await resolveSession(deps, token);
    expect(await readLastSeen()).toBe(clock.now().getTime());
  });

  it('ends the session of a user who has been blocked', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    await db.updateTable('appUser').set({ isBlocked: true }).where('id', '=', userId).execute();

    expect(await resolveSession(deps, token)).toBeNull();
    expect(await countSessions(userId)).toBe(0);
  });

  it('ends the session of a user who has been archived', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    await db
      .updateTable('appUser')
      .set({ archivedAt: new Date() })
      .where('id', '=', userId)
      .execute();

    expect(await resolveSession(deps, token)).toBeNull();
    expect(await countSessions(userId)).toBe(0);
  });

  it('deletes a session on logout', async () => {
    const userId = await newUser();
    const { token } = await createSession(deps, userId);

    await deleteSession(deps, token);

    expect(await resolveSession(deps, token)).toBeNull();
  });

  it('ends the other sessions of a user and keeps the current one', async () => {
    const userId = await newUser();
    const current = await createSession(deps, userId);
    const other = await createSession(deps, userId);
    const currentSession = await resolveSession(deps, current.token);

    await deleteOtherSessions(deps, userId, currentSession?.sessionId ?? -1);

    expect(await resolveSession(deps, current.token)).not.toBeNull();
    expect(await resolveSession(deps, other.token)).toBeNull();
  });
});
