import type {
  ClockCorrectionStatus,
  Half,
  LeaveStatus,
  NotificationPayload,
  NotificationType,
  WorkMode,
} from '@work-planner/domain';
import { expandWorkableHalfDays } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import { hashPassword } from '../auth/password-hasher';
import type { Database, SnapshotPeriod } from '../db/database';

export const DEFAULT_TEST_PASSWORD = 'correct horse battery staple';

// The Monday of the test clock's week (createTestClock defaults to Friday 2026-11-06).
const DEFAULT_TEST_START_DATE = '2026-11-02';

export interface TestUser {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  isAdmin?: boolean;
  isBlocked?: boolean;
  isArchived?: boolean;
  mustChangePassword?: boolean;
  dailyMinutes?: number;
  startDate?: string;
}

export interface TestTeam {
  name: string;
  parentTeamId?: number;
  managerId?: number;
  memberIds?: number[];
}

export async function insertUser(db: Kysely<Database>, user: TestUser): Promise<number> {
  const { id } = await db
    .insertInto('appUser')
    .values({
      email: user.email,
      firstName: user.firstName ?? 'Test',
      lastName: user.lastName ?? 'User',
      passwordHash: await hashPassword(user.password ?? DEFAULT_TEST_PASSWORD),
      isAdmin: user.isAdmin ?? false,
      isBlocked: user.isBlocked ?? false,
      mustChangePassword: user.mustChangePassword ?? false,
      archivedAt: user.isArchived ? new Date() : null,
      dailyMinutes: user.dailyMinutes,
      startDate: user.startDate ?? DEFAULT_TEST_START_DATE,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertTeam(db: Kysely<Database>, team: TestTeam): Promise<number> {
  const { id } = await db
    .insertInto('team')
    .values({
      name: team.name,
      parentTeamId: team.parentTeamId ?? null,
      managerId: team.managerId ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const userId of team.memberIds ?? []) {
    await db.insertInto('teamMember').values({ teamId: id, userId }).execute();
  }
  return id;
}

export async function insertClockDay(
  db: Kysely<Database>,
  day: { userId: number; workDate: string; workMode?: WorkMode },
): Promise<number> {
  const { id } = await db
    .insertInto('clockDay')
    .values({ userId: day.userId, workDate: day.workDate, workMode: day.workMode })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertClockPeriod(
  db: Kysely<Database>,
  period: { clockDayId: number; startedAt: Date; endedAt?: Date | null },
): Promise<number> {
  const { id } = await db
    .insertInto('clockPeriod')
    .values({
      clockDayId: period.clockDayId,
      startedAt: period.startedAt,
      endedAt: period.endedAt ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertCounterReset(
  db: Kysely<Database>,
  reset: { userId: number; resetDate: string; authorId: number; createdAt?: Date },
): Promise<number> {
  const { id } = await db
    .insertInto('counterReset')
    .values({
      userId: reset.userId,
      resetDate: reset.resetDate,
      authorId: reset.authorId,
      createdAt: reset.createdAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertDailyMinutesChange(
  db: Kysely<Database>,
  change: { userId: number; effectiveDate: string; previousDailyMinutes: number; authorId: number },
): Promise<number> {
  const { id } = await db
    .insertInto('dailyMinutesChange')
    .values(change)
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export interface TestClockCorrection {
  userId: number;
  authorId: number;
  workDate: string;
  status?: ClockCorrectionStatus;
  beforeWorkMode?: WorkMode | null;
  afterWorkMode?: WorkMode;
  beforePeriods?: SnapshotPeriod[];
  afterPeriods?: SnapshotPeriod[];
  comment?: string | null;
  responseComment?: string | null;
  respondedAt?: Date | null;
  createdAt?: Date;
}

export async function insertClockCorrection(
  db: Kysely<Database>,
  correction: TestClockCorrection,
): Promise<number> {
  const { id } = await db
    .insertInto('clockCorrection')
    .values({
      userId: correction.userId,
      authorId: correction.authorId,
      workDate: correction.workDate,
      status: correction.status ?? 'pending',
      beforeWorkMode: correction.beforeWorkMode ?? 'on_site',
      afterWorkMode: correction.afterWorkMode ?? 'on_site',
      beforePeriods: JSON.stringify(correction.beforePeriods ?? []),
      afterPeriods: JSON.stringify(correction.afterPeriods ?? []),
      comment: correction.comment ?? null,
      responseComment: correction.responseComment ?? null,
      respondedAt: correction.respondedAt ?? null,
      createdAt: correction.createdAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertNotification(
  db: Kysely<Database>,
  notification: {
    userId: number;
    type: NotificationType;
    payload: NotificationPayload;
    readAt?: Date | null;
  },
): Promise<number> {
  const { id } = await db
    .insertInto('notification')
    .values({
      userId: notification.userId,
      type: notification.type,
      payload: JSON.stringify(notification.payload),
      readAt: notification.readAt ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

export async function insertPublicHoliday(
  db: Kysely<Database>,
  holiday: { date: string; label?: string },
): Promise<void> {
  await db
    .insertInto('publicHoliday')
    .values({ holidayDate: holiday.date, label: holiday.label ?? 'Férié' })
    .execute();
}

export async function insertLeaveRequest(
  db: Kysely<Database>,
  request: {
    userId: number;
    dayTypeCode: string;
    startDate: string;
    startHalf?: Half;
    endDate?: string;
    endHalf?: Half;
    status?: LeaveStatus;
    reviewerId?: number;
    authorId?: number;
    reason?: string;
    reviewComment?: string;
  },
): Promise<number> {
  const range = {
    startDate: request.startDate,
    startHalf: request.startHalf ?? 'am',
    endDate: request.endDate ?? request.startDate,
    endHalf: request.endHalf ?? 'pm',
  };
  // Tests choose their dates: holidays are not skipped here, only weekends.
  const slots = expandWorkableHalfDays(range, new Set());
  const status = request.status ?? 'pending';
  const { id: dayTypeId } = await db
    .selectFrom('dayType')
    .select('id')
    .where('code', '=', request.dayTypeCode)
    .executeTakeFirstOrThrow();
  const { id } = await db
    .insertInto('leaveRequest')
    .values({
      userId: request.userId,
      authorId: request.authorId ?? request.userId,
      dayTypeId,
      ...range,
      halfDayCount: slots.length,
      status,
      reviewerId: request.reviewerId ?? null,
      reason: request.reason ?? null,
      reviewComment: request.reviewComment ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (status === 'pending' || status === 'approved') {
    await db
      .insertInto('halfDay')
      .values(
        slots.map((slot) => ({
          userId: request.userId,
          workDate: slot.date,
          half: slot.half,
          dayTypeId,
          leaveRequestId: id,
        })),
      )
      .execute();
  }
  return id;
}
