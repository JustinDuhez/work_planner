import {
  canEditPastClock,
  dayBounds,
  findDayPeriodViolation,
  localTimeToInstant,
  toWorkDate,
  truncateToMinute,
  type ClockDayMode,
  type ClockPeriodTimes,
  type ClockPeriodView,
  type StartClockPeriodRequest,
  type UpdateClockPeriodRequest,
  type WorkMode,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import type { ClockDependencies, ClockViewer } from './clock-dependencies';
import {
  ClockDayNotEditableError,
  ClockPeriodNotFoundError,
  ClockTimeInvalidError,
  clockViolationError,
} from './clock-errors';
import {
  deleteClockPeriodById,
  ensureClockDay,
  findPeriodsOfDay,
  findPeriodWithDay,
  insertClockPeriod,
  toClockPeriodView,
  translateClockConstraintError,
  updateClockPeriodTimes,
  upsertClockDayMode,
} from './clock-repository';

const DEFAULT_WORK_MODE: WorkMode = 'on_site';

interface ClockMoment {
  now: Date;
  today: string;
}

function momentOf(deps: ClockDependencies): ClockMoment {
  const now = truncateToMinute(deps.now());
  return { now, today: toWorkDate(now, deps.timeZone) };
}

function instantOn(deps: ClockDependencies, workDate: string, localTime: string): Date {
  const instant = localTimeToInstant(workDate, localTime, deps.timeZone);
  if (!instant) throw new ClockTimeInvalidError();
  return instant;
}

function assertValidDay(
  deps: ClockDependencies,
  check: { workDate: string; periods: readonly ClockPeriodTimes[]; now: Date },
): void {
  const violation = findDayPeriodViolation(
    check.periods,
    dayBounds(check.workDate, deps.timeZone),
    check.now,
  );
  if (violation) throw clockViolationError(violation);
}

async function inTransaction<T>(
  db: Kysely<Database>,
  work: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction().execute(work);
  } catch (error) {
    return translateClockConstraintError(error);
  }
}

export function startClockPeriod(
  deps: ClockDependencies,
  command: { viewer: ClockViewer } & StartClockPeriodRequest,
): Promise<ClockPeriodView> {
  const { now, today } = momentOf(deps);
  const startedAt = command.startedAt ? instantOn(deps, today, command.startedAt) : now;
  const endedAt = command.endedAt ? instantOn(deps, today, command.endedAt) : null;
  return inTransaction(deps.db, async (trx) => {
    const day = await ensureClockDay(trx, {
      userId: command.viewer.id,
      workDate: today,
      workMode: command.workMode ?? DEFAULT_WORK_MODE,
    });
    const existing = await findPeriodsOfDay(trx, day.id);
    assertValidDay(deps, { workDate: today, periods: [...existing, { startedAt, endedAt }], now });
    return toClockPeriodView(
      await insertClockPeriod(trx, { clockDayId: day.id, startedAt, endedAt }),
    );
  });
}

function resolveEnd(
  deps: ClockDependencies,
  change: { workDate: string; requested: string | undefined; current: Date | null; now: Date },
): Date | null {
  if (change.requested === undefined) return change.current;
  return change.requested === 'now'
    ? change.now
    : instantOn(deps, change.workDate, change.requested);
}

/** Past days are frozen except the missing end of an unclosed day (owner once, or manager/admin). */
async function assertCanClosePastPeriod(
  period: { userId: number; endedAt: Date | null },
  command: { viewer: ClockViewer } & UpdateClockPeriodRequest,
): Promise<void> {
  const isClosingTheOpenEnd =
    period.endedAt === null &&
    command.startedAt === undefined &&
    command.endedAt !== undefined &&
    command.endedAt !== 'now';
  if (!isClosingTheOpenEnd) throw new ClockDayNotEditableError();
  const isOwner = period.userId === command.viewer.id;
  if (!isOwner && !canEditPastClock(await command.viewer.loadActor(), period.userId)) {
    throw new ClockDayNotEditableError();
  }
}

export function updateClockPeriod(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; periodId: number } & UpdateClockPeriodRequest,
): Promise<ClockPeriodView> {
  const { now, today } = momentOf(deps);
  return inTransaction(deps.db, async (trx) => {
    const period = await findPeriodWithDay(trx, command.periodId, { shouldLock: true });
    if (!period) throw new ClockPeriodNotFoundError();
    const isToday = period.workDate === today;
    if (isToday && period.userId !== command.viewer.id) throw new ClockDayNotEditableError();
    if (!isToday && period.workDate > today) throw new ClockDayNotEditableError();
    if (!isToday) await assertCanClosePastPeriod(period, command);
    const startedAt = command.startedAt
      ? instantOn(deps, period.workDate, command.startedAt)
      : period.startedAt;
    const endedAt = resolveEnd(deps, {
      workDate: period.workDate,
      requested: command.endedAt,
      current: period.endedAt,
      now,
    });
    const others = (await findPeriodsOfDay(trx, period.clockDayId)).filter(
      (other) => other.id !== period.id,
    );
    assertValidDay(deps, {
      workDate: period.workDate,
      periods: [...others, { startedAt, endedAt }],
      now,
    });
    return toClockPeriodView(await updateClockPeriodTimes(trx, period.id, { startedAt, endedAt }));
  });
}

export async function deleteClockPeriod(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; periodId: number },
): Promise<void> {
  const { today } = momentOf(deps);
  const period = await findPeriodWithDay(deps.db, command.periodId);
  if (!period) throw new ClockPeriodNotFoundError();
  if (period.workDate !== today || period.userId !== command.viewer.id)
    throw new ClockDayNotEditableError();
  await deleteClockPeriodById(deps.db, period.id);
}

export async function setClockDayMode(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; date: string; workMode: WorkMode },
): Promise<ClockDayMode> {
  const { today } = momentOf(deps);
  if (command.date !== today) throw new ClockDayNotEditableError();
  return await upsertClockDayMode(deps.db, {
    userId: command.viewer.id,
    workDate: today,
    workMode: command.workMode,
  });
}
