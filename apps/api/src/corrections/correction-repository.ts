import type {
  ClockCorrectionStatus,
  ClockPeriodTimes,
  CorrectionStatusRecord,
  UserSummary,
  WorkMode,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database, SnapshotPeriod } from '../db/database';

export interface StoredClockCorrection {
  id: number;
  user: UserSummary;
  author: UserSummary;
  workDate: string;
  beforeWorkMode: WorkMode | null;
  afterWorkMode: WorkMode;
  beforePeriods: SnapshotPeriod[];
  afterPeriods: SnapshotPeriod[];
  comment: string | null;
  status: ClockCorrectionStatus;
  responseComment: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

export function toSnapshot(periods: readonly ClockPeriodTimes[]): string {
  return JSON.stringify(
    periods.map((period) => ({
      startedAt: period.startedAt.toISOString(),
      endedAt: period.endedAt?.toISOString() ?? null,
    })),
  );
}

/** The day row exists and is locked: concurrent corrections of one day run one after the other. */
export async function lockClockDay(
  trx: Kysely<Database>,
  day: { userId: number; workDate: string; workMode: WorkMode },
): Promise<{ id: number; workMode: WorkMode; hadRecord: boolean }> {
  const select = () =>
    trx
      .selectFrom('clockDay')
      .select(['id', 'workMode'])
      .where('userId', '=', day.userId)
      .where('workDate', '=', day.workDate)
      .forUpdate()
      .executeTakeFirst();
  const existing = await select();
  if (existing) return { ...existing, hadRecord: true };
  const inserted = await trx
    .insertInto('clockDay')
    .values(day)
    .onConflict((conflict) => conflict.columns(['userId', 'workDate']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const created = await select();
  if (!created) throw new Error(`Clock day of ${day.workDate} vanished while locking it`);
  // DO NOTHING means another transaction created the day first: it had a record by then.
  return { ...created, hadRecord: inserted === undefined };
}

export async function replaceDayPeriods(
  trx: Kysely<Database>,
  clockDayId: number,
  periods: readonly ClockPeriodTimes[],
): Promise<void> {
  await trx.deleteFrom('clockPeriod').where('clockDayId', '=', clockDayId).execute();
  if (periods.length === 0) return;
  await trx
    .insertInto('clockPeriod')
    .values(
      periods.map((period) => ({
        clockDayId,
        startedAt: period.startedAt,
        endedAt: period.endedAt,
      })),
    )
    .execute();
}

export async function setClockDayWorkMode(
  trx: Kysely<Database>,
  clockDayId: number,
  workMode: WorkMode,
): Promise<void> {
  await trx.updateTable('clockDay').set({ workMode }).where('id', '=', clockDayId).execute();
}

export async function supersedePendingCorrection(
  trx: Kysely<Database>,
  day: { userId: number; workDate: string },
): Promise<number | undefined> {
  const row = await trx
    .updateTable('clockCorrection')
    .set({ status: 'superseded' })
    .where('userId', '=', day.userId)
    .where('workDate', '=', day.workDate)
    .where('status', '=', 'pending')
    .returning('id')
    .executeTakeFirst();
  return row?.id;
}

export async function insertClockCorrectionRow(
  trx: Kysely<Database>,
  values: {
    userId: number;
    workDate: string;
    authorId: number;
    beforeWorkMode: WorkMode | null;
    afterWorkMode: WorkMode;
    beforePeriods: string;
    afterPeriods: string;
    comment: string | null;
    status: 'pending' | 'accepted';
    respondedAt: Date | null;
  },
): Promise<number> {
  const { id } = await trx
    .insertInto('clockCorrection')
    .values(values)
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

function correctionQuery(db: Kysely<Database>) {
  return db
    .selectFrom('clockCorrection')
    .innerJoin('appUser as owner', 'owner.id', 'clockCorrection.userId')
    .innerJoin('appUser as author', 'author.id', 'clockCorrection.authorId')
    .select([
      'clockCorrection.id',
      'clockCorrection.workDate',
      'clockCorrection.beforeWorkMode',
      'clockCorrection.afterWorkMode',
      'clockCorrection.beforePeriods',
      'clockCorrection.afterPeriods',
      'clockCorrection.comment',
      'clockCorrection.status',
      'clockCorrection.responseComment',
      'clockCorrection.createdAt',
      'clockCorrection.respondedAt',
      'owner.id as ownerId',
      'owner.firstName as ownerFirstName',
      'owner.lastName as ownerLastName',
      'author.id as authorId',
      'author.firstName as authorFirstName',
      'author.lastName as authorLastName',
    ]);
}

interface CorrectionRow {
  id: number;
  workDate: string;
  beforeWorkMode: WorkMode | null;
  afterWorkMode: WorkMode;
  beforePeriods: SnapshotPeriod[];
  afterPeriods: SnapshotPeriod[];
  comment: string | null;
  status: ClockCorrectionStatus;
  responseComment: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  ownerId: number;
  ownerFirstName: string;
  ownerLastName: string;
  authorId: number;
  authorFirstName: string;
  authorLastName: string;
}

function toStoredCorrection(row: CorrectionRow): StoredClockCorrection {
  const {
    ownerId,
    ownerFirstName,
    ownerLastName,
    authorId,
    authorFirstName,
    authorLastName,
    ...correction
  } = row;
  return {
    ...correction,
    user: { id: ownerId, firstName: ownerFirstName, lastName: ownerLastName },
    author: { id: authorId, firstName: authorFirstName, lastName: authorLastName },
  };
}

export async function findClockCorrectionById(
  db: Kysely<Database>,
  correctionId: number,
): Promise<StoredClockCorrection | undefined> {
  const row = await correctionQuery(db)
    .where('clockCorrection.id', '=', correctionId)
    .executeTakeFirst();
  return row && toStoredCorrection(row);
}

export async function findClockCorrections(
  db: Kysely<Database>,
  query: { userId: number; status?: ClockCorrectionStatus },
): Promise<StoredClockCorrection[]> {
  let select = correctionQuery(db).where('clockCorrection.userId', '=', query.userId);
  if (query.status) select = select.where('clockCorrection.status', '=', query.status);
  const rows = await select
    .orderBy('clockCorrection.createdAt', 'desc')
    .orderBy('clockCorrection.id', 'desc')
    .execute();
  return rows.map(toStoredCorrection);
}

/** Conditional on `pending`: of two simultaneous answers, only one updates a row. */
export async function answerPendingCorrection(
  trx: Kysely<Database>,
  answer: {
    correctionId: number;
    status: 'accepted' | 'refused';
    responseComment: string | null;
    respondedAt: Date;
  },
): Promise<boolean> {
  const row = await trx
    .updateTable('clockCorrection')
    .set({
      status: answer.status,
      responseComment: answer.responseComment,
      respondedAt: answer.respondedAt,
    })
    .where('id', '=', answer.correctionId)
    .where('status', '=', 'pending')
    .returning('id')
    .executeTakeFirst();
  return row !== undefined;
}

export function findCorrectionStatusRecords(
  db: Kysely<Database>,
  userId: number,
): Promise<CorrectionStatusRecord[]> {
  return db
    .selectFrom('clockCorrection')
    .select(['id', 'workDate', 'status', 'createdAt'])
    .where('userId', '=', userId)
    .where('status', '<>', 'superseded')
    .execute();
}
