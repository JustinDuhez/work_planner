import {
  canManageHolidays,
  type CreatePublicHolidayRequest,
  type PublicHoliday,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { ClockViewer } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { assertRealDate } from '../http/real-date';
import {
  HolidayExistsError,
  HolidayManagementForbiddenError,
  HolidayNotFoundError,
} from './holiday-errors';
import { insertFrenchHolidays } from './holiday-repository';

async function assertCanManageHolidays(viewer: ClockViewer): Promise<void> {
  if (!canManageHolidays(await viewer.loadActor())) throw new HolidayManagementForbiddenError();
}

export async function addPublicHoliday(
  db: Kysely<Database>,
  command: { viewer: ClockViewer } & CreatePublicHolidayRequest,
): Promise<PublicHoliday> {
  await assertCanManageHolidays(command.viewer);
  assertRealDate(command.date, 'date');
  const inserted = await db
    .insertInto('publicHoliday')
    .values({ holidayDate: command.date, label: command.label })
    .onConflict((conflict) => conflict.column('holidayDate').doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) throw new HolidayExistsError();
  return { date: command.date, label: command.label };
}

export async function removePublicHoliday(
  db: Kysely<Database>,
  command: { viewer: ClockViewer; date: string },
): Promise<void> {
  await assertCanManageHolidays(command.viewer);
  assertRealDate(command.date, 'date');
  const deleted = await db
    .deleteFrom('publicHoliday')
    .where('holidayDate', '=', command.date)
    .returning('id')
    .executeTakeFirst();
  if (!deleted) throw new HolidayNotFoundError();
}

export async function importFrenchHolidays(
  db: Kysely<Database>,
  command: { viewer: ClockViewer; year: number },
): Promise<{ addedCount: number }> {
  await assertCanManageHolidays(command.viewer);
  return { addedCount: await insertFrenchHolidays(db, command.year) };
}
