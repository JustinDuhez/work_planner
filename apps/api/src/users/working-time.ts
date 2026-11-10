import {
  canEditDailyMinutes,
  canManageUsers,
  planDailyMinutesChange,
  toWorkDate,
  type DirectoryEntry,
  type UpdateWorkingTimeRequest,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { findDailyMinutesChanges } from '../counters/counter-repository';
import { assertRealDate } from '../http/real-date';
import { loadDirectoryEntry } from './directory';
import {
  UserNotFoundError,
  WorkingTimeChangeOrderError,
  WorkingTimeDateInPastError,
  WorkingTimeForbiddenError,
} from './user-errors';

export async function updateWorkingTime(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; userId: number } & UpdateWorkingTimeRequest,
): Promise<DirectoryEntry> {
  const actor = await command.viewer.loadActor();
  const isEditingStartDate = command.startDate !== undefined;
  // Permission first: an outsider learns nothing about which ids exist.
  const isAllowed =
    canEditDailyMinutes(actor, command.userId) && (!isEditingStartDate || canManageUsers(actor));
  if (!isAllowed) throw new WorkingTimeForbiddenError();
  if (command.startDate !== undefined) assertRealDate(command.startDate, 'startDate');
  if (command.effectiveDate !== undefined) assertRealDate(command.effectiveDate, 'effectiveDate');
  const today = toWorkDate(deps.now(), deps.timeZone);
  const effectiveDate = command.effectiveDate ?? today;

  await deps.db.transaction().execute(async (trx) => {
    // The row lock serializes two edits of one person: the second sees the first's change row.
    const target = await trx
      .selectFrom('appUser')
      .select(['id', 'dailyMinutes'])
      .where('id', '=', command.userId)
      .where('archivedAt', 'is', null)
      .forUpdate()
      .executeTakeFirst();
    if (!target) throw new UserNotFoundError();
    if (command.dailyMinutes !== undefined) {
      const plan = planDailyMinutesChange({
        effectiveDate,
        today,
        currentDailyMinutes: target.dailyMinutes,
        changes: await findDailyMinutesChanges(trx, target.id),
      });
      if (plan.kind === 'refused') {
        throw plan.reason === 'DATE_IN_PAST'
          ? new WorkingTimeDateInPastError()
          : new WorkingTimeChangeOrderError();
      }
      if (plan.kind === 'insert') {
        await trx
          .insertInto('dailyMinutesChange')
          .values({
            userId: target.id,
            effectiveDate,
            previousDailyMinutes: plan.previousDailyMinutes,
            authorId: command.viewer.id,
          })
          .execute();
      }
      await trx
        .updateTable('appUser')
        .set({ dailyMinutes: command.dailyMinutes })
        .where('id', '=', target.id)
        .execute();
    }
    if (command.startDate !== undefined) {
      await trx
        .updateTable('appUser')
        .set({ startDate: command.startDate })
        .where('id', '=', target.id)
        .execute();
    }
  });
  return loadDirectoryEntry(deps, { viewer: command.viewer, userId: command.userId });
}
