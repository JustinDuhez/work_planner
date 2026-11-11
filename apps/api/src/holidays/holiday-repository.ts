import { frenchPublicHolidays, type PublicHoliday } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';

export async function findPublicHolidays(
  db: Kysely<Database>,
  range: { fromDate: string; toDate: string },
): Promise<PublicHoliday[]> {
  const rows = await db
    .selectFrom('publicHoliday')
    .select(['holidayDate', 'label'])
    .where('holidayDate', '>=', range.fromDate)
    .where('holidayDate', '<=', range.toDate)
    .orderBy('holidayDate')
    .execute();
  return rows.map((row) => ({ date: row.holidayDate, label: row.label }));
}

/** Idempotent (spec §3.8): dates already present, imported or added by hand, are left alone. */
export async function insertFrenchHolidays(db: Kysely<Database>, year: number): Promise<number> {
  const inserted = await db
    .insertInto('publicHoliday')
    .values(
      frenchPublicHolidays(year).map((holiday) => ({
        holidayDate: holiday.date,
        label: holiday.label,
      })),
    )
    .onConflict((conflict) => conflict.column('holidayDate').doNothing())
    .returning('id')
    .execute();
  return inserted.length;
}
