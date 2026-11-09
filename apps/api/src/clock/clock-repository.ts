import type { ClockDayMode, ClockPeriodView, WorkMode } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import {
  ClockAlreadyRunningError,
  ClockPeriodOverlapError,
  ClockWriteConflictError,
} from './clock-errors';

export interface StoredClockPeriod {
  id: number;
  startedAt: Date;
  endedAt: Date | null;
}

export interface StoredClockDay {
  id: number;
  workDate: string;
  workMode: WorkMode;
  periods: StoredClockPeriod[];
}

export function toClockPeriodView(period: StoredClockPeriod): ClockPeriodView {
  return {
    id: period.id,
    startedAt: period.startedAt.toISOString(),
    endedAt: period.endedAt?.toISOString() ?? null,
  };
}

export async function findClockDays(
  db: Kysely<Database>,
  userId: number,
  fromDate: string,
  toDate: string,
): Promise<Map<string, StoredClockDay>> {
  const rows = await db
    .selectFrom('clockDay')
    .leftJoin('clockPeriod', 'clockPeriod.clockDayId', 'clockDay.id')
    .select([
      'clockDay.id as dayId',
      'clockDay.workDate',
      'clockDay.workMode',
      'clockPeriod.id as periodId',
      'clockPeriod.startedAt',
      'clockPeriod.endedAt',
    ])
    .where('clockDay.userId', '=', userId)
    .where('clockDay.workDate', '>=', fromDate)
    .where('clockDay.workDate', '<=', toDate)
    .orderBy('clockDay.workDate')
    .orderBy('clockPeriod.startedAt')
    .execute();
  const days = new Map<string, StoredClockDay>();
  for (const row of rows) {
    let day = days.get(row.workDate);
    if (!day) {
      day = { id: row.dayId, workDate: row.workDate, workMode: row.workMode, periods: [] };
      days.set(row.workDate, day);
    }
    if (row.periodId !== null && row.startedAt !== null) {
      day.periods.push({ id: row.periodId, startedAt: row.startedAt, endedAt: row.endedAt });
    }
  }
  return days;
}

const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
const LOCK_FAILURE_CODES = ['40P01', '40001']; // deadlock, serialization failure
const ONE_OPEN_PERIOD_CONSTRAINT = 'clock_period_one_open_per_day';

/** The database is the last line of defense against races (double Start, concurrent edits). */
export function translateClockConstraintError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const isOpenPeriodConflict =
      error.code === UNIQUE_VIOLATION &&
      'constraint' in error &&
      error.constraint === ONE_OPEN_PERIOD_CONSTRAINT;
    if (isOpenPeriodConflict) throw new ClockAlreadyRunningError();
    if (error.code === EXCLUSION_VIOLATION) throw new ClockPeriodOverlapError();
    if (LOCK_FAILURE_CODES.includes(String(error.code))) throw new ClockWriteConflictError();
  }
  throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
}

/** A clock write: DB constraint violations (races) become the E3 API errors. */
export async function inClockTransaction<T>(
  db: Kysely<Database>,
  work: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction().execute(work);
  } catch (error) {
    return translateClockConstraintError(error);
  }
}

export function findPeriodsOfDay(
  db: Kysely<Database>,
  clockDayId: number,
): Promise<StoredClockPeriod[]> {
  return db
    .selectFrom('clockPeriod')
    .select(['id', 'startedAt', 'endedAt'])
    .where('clockDayId', '=', clockDayId)
    .orderBy('startedAt')
    .execute();
}

export async function ensureClockDay(
  db: Kysely<Database>,
  day: { userId: number; workDate: string; workMode: WorkMode },
): Promise<{ id: number }> {
  await db
    .insertInto('clockDay')
    .values(day)
    .onConflict((conflict) => conflict.columns(['userId', 'workDate']).doNothing())
    .execute();
  return db
    .selectFrom('clockDay')
    .select('id')
    .where('userId', '=', day.userId)
    .where('workDate', '=', day.workDate)
    .executeTakeFirstOrThrow();
}

export function insertClockPeriod(
  db: Kysely<Database>,
  values: { clockDayId: number; startedAt: Date; endedAt: Date | null },
): Promise<StoredClockPeriod> {
  return db
    .insertInto('clockPeriod')
    .values(values)
    .returning(['id', 'startedAt', 'endedAt'])
    .executeTakeFirstOrThrow();
}

export function updateClockPeriodTimes(
  db: Kysely<Database>,
  periodId: number,
  times: { startedAt: Date; endedAt: Date | null },
): Promise<StoredClockPeriod> {
  return db
    .updateTable('clockPeriod')
    .set(times)
    .where('id', '=', periodId)
    .returning(['id', 'startedAt', 'endedAt'])
    .executeTakeFirstOrThrow();
}

export async function deleteClockPeriodById(db: Kysely<Database>, periodId: number): Promise<void> {
  await db.deleteFrom('clockPeriod').where('id', '=', periodId).execute();
}

export function findPeriodWithDay(
  db: Kysely<Database>,
  periodId: number,
  options: { shouldLock?: boolean } = {},
): Promise<
  (StoredClockPeriod & { clockDayId: number; userId: number; workDate: string }) | undefined
> {
  const query = db
    .selectFrom('clockPeriod')
    .innerJoin('clockDay', 'clockDay.id', 'clockPeriod.clockDayId')
    .select([
      'clockPeriod.id',
      'clockPeriod.startedAt',
      'clockPeriod.endedAt',
      'clockPeriod.clockDayId',
      'clockDay.userId',
      'clockDay.workDate',
    ])
    .where('clockPeriod.id', '=', periodId);
  // Row lock (period and its day): concurrent edits of the same period run one after the other.
  return (options.shouldLock ? query.forUpdate() : query).executeTakeFirst();
}

export function upsertClockDayMode(
  db: Kysely<Database>,
  day: { userId: number; workDate: string; workMode: WorkMode },
): Promise<ClockDayMode> {
  return db
    .insertInto('clockDay')
    .values(day)
    .onConflict((conflict) =>
      conflict.columns(['userId', 'workDate']).doUpdateSet({ workMode: day.workMode }),
    )
    .returning(['workDate as date', 'workMode'])
    .executeTakeFirstOrThrow();
}
