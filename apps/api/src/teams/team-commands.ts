import {
  canManageTeams,
  isInSubtree,
  type CreateTeamRequest,
  type TeamLink,
  type TeamView,
  type UpdateTeamRequest,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { ClockViewer } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { isUniqueViolation } from '../db/postgres-errors';
import {
  TeamCycleError,
  TeamHasSubteamsError,
  TeamInvalidPersonError,
  TeamManagementForbiddenError,
  TeamNameTakenError,
  TeamNotFoundError,
} from './team-errors';
import { countActivePeople, lockTeamTree, replaceActiveMembers } from './team-repository';
import { loadTeam } from './teams';

async function assertCanManageTeams(viewer: ClockViewer): Promise<void> {
  if (!canManageTeams(await viewer.loadActor())) throw new TeamManagementForbiddenError();
}

async function assertActivePeople(
  db: Kysely<Database>,
  people: { managerId?: number | null; memberIds?: readonly number[] },
): Promise<void> {
  if (people.managerId !== undefined && people.managerId !== null) {
    if ((await countActivePeople(db, [people.managerId])) !== 1)
      throw new TeamInvalidPersonError('managerId');
  }
  if (people.memberIds !== undefined) {
    const uniqueIds = [...new Set(people.memberIds)];
    if ((await countActivePeople(db, uniqueIds)) !== uniqueIds.length)
      throw new TeamInvalidPersonError('memberIds');
  }
}

function assertParentExists(
  tree: readonly TeamLink[],
  parentTeamId: number | null | undefined,
): void {
  if (parentTeamId === undefined || parentTeamId === null) return;
  if (!tree.some((team) => team.id === parentTeamId)) throw new TeamNotFoundError();
}

function translateNameConflict(error: unknown): never {
  // Two admins naming a team the same at once: the unique index decides.
  if (isUniqueViolation(error)) throw new TeamNameTakenError();
  throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
}

async function isNameTaken(
  db: Kysely<Database>,
  name: string,
  exceptTeamId?: number,
): Promise<boolean> {
  let select = db.selectFrom('team').select('id').where('name', '=', name);
  if (exceptTeamId !== undefined) select = select.where('id', '<>', exceptTeamId);
  return (await select.executeTakeFirst()) !== undefined;
}

export async function createTeam(
  db: Kysely<Database>,
  command: { viewer: ClockViewer } & CreateTeamRequest,
): Promise<TeamView> {
  await assertCanManageTeams(command.viewer);
  await assertActivePeople(db, command);
  if (await isNameTaken(db, command.name)) throw new TeamNameTakenError();
  let teamId = 0;
  try {
    teamId = await db.transaction().execute(async (trx) => {
      assertParentExists(await lockTeamTree(trx), command.parentTeamId);
      const { id } = await trx
        .insertInto('team')
        .values({
          name: command.name,
          parentTeamId: command.parentTeamId ?? null,
          managerId: command.managerId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await replaceActiveMembers(trx, id, [...new Set(command.memberIds ?? [])]);
      return id;
    });
  } catch (error) {
    translateNameConflict(error);
  }
  return loadTeam(db, { viewer: command.viewer, teamId });
}

export async function updateTeam(
  db: Kysely<Database>,
  command: { viewer: ClockViewer; teamId: number } & UpdateTeamRequest,
): Promise<TeamView> {
  const { viewer, teamId, ...changes } = command;
  await assertCanManageTeams(viewer);
  await assertActivePeople(db, changes);
  if (changes.name !== undefined && (await isNameTaken(db, changes.name, teamId)))
    throw new TeamNameTakenError();
  try {
    await db.transaction().execute(async (trx) => {
      const tree = await lockTeamTree(trx);
      if (!tree.some((team) => team.id === teamId)) throw new TeamNotFoundError();
      assertParentExists(tree, changes.parentTeamId);
      if (
        changes.parentTeamId !== undefined &&
        changes.parentTeamId !== null &&
        isInSubtree(tree, teamId, changes.parentTeamId)
      ) {
        throw new TeamCycleError();
      }
      const hasTeamFields =
        changes.name !== undefined ||
        changes.parentTeamId !== undefined ||
        changes.managerId !== undefined;
      // A members-only edit must not send an UPDATE with nothing to set.
      if (hasTeamFields) {
        await trx
          .updateTable('team')
          .set({
            name: changes.name,
            parentTeamId: changes.parentTeamId,
            managerId: changes.managerId,
          })
          .where('id', '=', teamId)
          .execute();
      }
      if (changes.memberIds !== undefined) {
        await replaceActiveMembers(trx, teamId, [...new Set(changes.memberIds)]);
      }
    });
  } catch (error) {
    translateNameConflict(error);
  }
  return loadTeam(db, { viewer, teamId });
}

export async function deleteTeam(
  db: Kysely<Database>,
  command: { viewer: ClockViewer; teamId: number },
): Promise<void> {
  await assertCanManageTeams(command.viewer);
  await db.transaction().execute(async (trx) => {
    const tree = await lockTeamTree(trx);
    if (!tree.some((team) => team.id === command.teamId)) throw new TeamNotFoundError();
    if (tree.some((team) => team.parentTeamId === command.teamId)) throw new TeamHasSubteamsError();
    // team_member rows go with the team (ON DELETE CASCADE); the people are untouched (E2b-D1).
    await trx.deleteFrom('team').where('id', '=', command.teamId).execute();
  });
}
