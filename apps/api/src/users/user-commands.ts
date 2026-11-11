import {
  canManageUsers,
  findPasswordPolicyViolation,
  findUserAccessViolation,
  toWorkDate,
  type CreateUserRequest,
  type DirectoryEntry,
  type UpdateUserRequest,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import { PasswordPolicyError } from '../auth/auth-errors';
import { hashPassword } from '../auth/password-hasher';
import { deleteAllSessions } from '../auth/session-service';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { isUniqueViolation } from '../db/postgres-errors';
import { loadDirectoryEntry } from './directory';
import {
  UserEmailTakenError,
  UserLastAdminError,
  UserManagementForbiddenError,
  UserManagesTeamError,
  UserNotFoundError,
  UserSelfRestrictionError,
} from './user-errors';

const DEFAULT_DAILY_MINUTES = 420;

async function assertCanManageUsers(viewer: ClockViewer): Promise<void> {
  if (!canManageUsers(await viewer.loadActor())) throw new UserManagementForbiddenError();
}

function assertStrongPassword(password: string, field: string): void {
  const violation = findPasswordPolicyViolation(password);
  if (violation) throw new PasswordPolicyError(violation, field);
}

async function isEmailTaken(
  db: Kysely<Database>,
  email: string,
  exceptUserId?: number,
): Promise<boolean> {
  let select = db.selectFrom('appUser').select('id').where('email', '=', email);
  if (exceptUserId !== undefined) select = select.where('id', '<>', exceptUserId);
  return (await select.executeTakeFirst()) !== undefined;
}

function translateEmailConflict(error: unknown): never {
  // Two admins creating the same email at once: the unique index decides.
  if (isUniqueViolation(error)) throw new UserEmailTakenError();
  throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
}

export async function createUser(
  deps: ClockDependencies,
  command: { viewer: ClockViewer } & CreateUserRequest,
): Promise<DirectoryEntry> {
  await assertCanManageUsers(command.viewer);
  assertStrongPassword(command.initialPassword, 'initialPassword');
  if (await isEmailTaken(deps.db, command.email)) throw new UserEmailTakenError();
  const passwordHash = await hashPassword(command.initialPassword);
  let userId: number;
  try {
    ({ id: userId } = await deps.db
      .insertInto('appUser')
      .values({
        firstName: command.firstName,
        lastName: command.lastName,
        email: command.email,
        isAdmin: command.isAdmin,
        passwordHash,
        dailyMinutes: command.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
        startDate: command.startDate ?? toWorkDate(deps.now(), deps.timeZone),
        // E2a-D2: the admin knows this password, so the person must replace it.
        mustChangePassword: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow());
  } catch (error) {
    translateEmailConflict(error);
  }
  return loadDirectoryEntry(deps, { viewer: command.viewer, userId });
}

/**
 * Locks every active admin row: two admins removing each other at once would otherwise both see
 * two admins and both succeed (the only way to reach USER_LAST_ADMIN, since self-removal is refused).
 */
async function lockActiveAdminIds(trx: Kysely<Database>): Promise<number[]> {
  const rows = await trx
    .selectFrom('appUser')
    .select('id')
    .where('isAdmin', '=', true)
    .where('isBlocked', '=', false)
    .where('archivedAt', 'is', null)
    .orderBy('id')
    .forUpdate()
    .execute();
  return rows.map((row) => row.id);
}

async function findManagedTeamName(
  db: Kysely<Database>,
  userId: number,
): Promise<string | undefined> {
  const team = await db
    .selectFrom('team')
    .select('name')
    .where('managerId', '=', userId)
    .orderBy('name')
    .limit(1)
    .executeTakeFirst();
  return team?.name;
}

export async function updateUser(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; userId: number } & UpdateUserRequest,
): Promise<DirectoryEntry> {
  await assertCanManageUsers(command.viewer);
  const { viewer, userId, ...changes } = command;
  const removesAccess =
    changes.isAdmin === false || changes.isBlocked === true || changes.isArchived === true;
  if (changes.email !== undefined && (await isEmailTaken(deps.db, changes.email, userId))) {
    throw new UserEmailTakenError();
  }
  try {
    await deps.db.transaction().execute(async (trx) => {
      const activeAdminIds = await lockActiveAdminIds(trx);
      // The early check ran outside this transaction: an admin demoted since then must not finish.
      if (!activeAdminIds.includes(viewer.id)) throw new UserManagementForbiddenError();
      const target = await trx
        .selectFrom('appUser')
        .select(['id', 'email', 'isAdmin', 'isBlocked', 'archivedAt'])
        .where('id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!target) throw new UserNotFoundError();
      const violation = findUserAccessViolation({
        isSelf: target.id === viewer.id,
        removesAccess,
        removesActiveAdmin: removesAccess && activeAdminIds.includes(target.id),
        activeAdminCount: activeAdminIds.length,
      });
      if (violation === 'USER_SELF_RESTRICTION') throw new UserSelfRestrictionError();
      if (violation === 'USER_LAST_ADMIN') throw new UserLastAdminError();
      const isArchiving = changes.isArchived === true && target.archivedAt === null;
      const managedTeamName = isArchiving ? await findManagedTeamName(trx, target.id) : undefined;
      if (managedTeamName !== undefined) throw new UserManagesTeamError(managedTeamName);
      // E1 carry-forward: identity or credential changes end every session of that person.
      const logsOutEverywhere =
        (changes.email !== undefined && changes.email !== target.email) ||
        (changes.isAdmin !== undefined && changes.isAdmin !== target.isAdmin) ||
        (changes.isBlocked === true && !target.isBlocked) ||
        isArchiving;
      await trx
        .updateTable('appUser')
        .set({
          firstName: changes.firstName,
          lastName: changes.lastName,
          email: changes.email,
          isAdmin: changes.isAdmin,
          isBlocked: changes.isBlocked,
          // Written only on a real change: archive data (and its date) is kept as is.
          ...(isArchiving ? { archivedAt: deps.now() } : {}),
          ...(changes.isArchived === false ? { archivedAt: null } : {}),
        })
        .where('id', '=', target.id)
        .execute();
      if (logsOutEverywhere) await deleteAllSessions(trx, target.id);
    });
  } catch (error) {
    translateEmailConflict(error);
  }
  return loadDirectoryEntry(deps, { viewer, userId });
}

export async function resetUserPassword(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; userId: number; newPassword: string },
): Promise<void> {
  await assertCanManageUsers(command.viewer);
  assertStrongPassword(command.newPassword, 'newPassword');
  const passwordHash = await hashPassword(command.newPassword);
  await deps.db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('appUser')
      .set({ passwordHash, mustChangePassword: true })
      .where('id', '=', command.userId)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw new UserNotFoundError();
    await deleteAllSessions(trx, command.userId);
  });
}
