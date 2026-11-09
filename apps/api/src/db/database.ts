import type {
  ClockCorrectionStatus,
  NotificationPayload,
  NotificationType,
  WorkMode,
} from '@work-planner/domain';
import type { ColumnType, Generated } from 'kysely';

type NullableColumn<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface SettingTable {
  id: Generated<number>;
  key: string;
  value: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface AppUserTable {
  id: Generated<number>;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isAdmin: Generated<boolean>;
  isBlocked: Generated<boolean>;
  archivedAt: NullableColumn<Date>;
  dailyMinutes: Generated<number>;
  startDate: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface SessionTable {
  id: Generated<number>;
  tokenHash: string;
  userId: number;
  csrfToken: string;
  lastSeenAt: Date;
  expiresAt: Date;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface TeamTable {
  id: Generated<number>;
  name: string;
  parentTeamId: NullableColumn<number>;
  managerId: NullableColumn<number>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface TeamMemberTable {
  teamId: number;
  userId: number;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ClockDayTable {
  id: Generated<number>;
  userId: number;
  workDate: string;
  workMode: Generated<WorkMode>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ClockPeriodTable {
  id: Generated<number>;
  clockDayId: number;
  startedAt: Date;
  endedAt: NullableColumn<Date>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface CounterResetTable {
  id: Generated<number>;
  userId: number;
  resetDate: string;
  authorId: number;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface DailyMinutesChangeTable {
  id: Generated<number>;
  userId: number;
  effectiveDate: string;
  previousDailyMinutes: number;
  authorId: number;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface SnapshotPeriod {
  startedAt: string;
  endedAt: string | null;
}

// JSONB: pg parses it on read; writes go through JSON.stringify (a JS array would become a
// Postgres array literal otherwise).
type JsonColumn<T> = ColumnType<T, string, string>;

export interface ClockCorrectionTable {
  id: Generated<number>;
  userId: number;
  workDate: string;
  authorId: number;
  beforeWorkMode: NullableColumn<WorkMode>;
  afterWorkMode: WorkMode;
  beforePeriods: JsonColumn<SnapshotPeriod[]>;
  afterPeriods: JsonColumn<SnapshotPeriod[]>;
  comment: NullableColumn<string>;
  status: ClockCorrectionStatus;
  responseComment: NullableColumn<string>;
  respondedAt: NullableColumn<Date>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface NotificationTable {
  id: Generated<number>;
  userId: number;
  type: NotificationType;
  payload: JsonColumn<NotificationPayload>;
  readAt: NullableColumn<Date>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface Database {
  setting: SettingTable;
  appUser: AppUserTable;
  session: SessionTable;
  team: TeamTable;
  teamMember: TeamMemberTable;
  clockDay: ClockDayTable;
  clockPeriod: ClockPeriodTable;
  counterReset: CounterResetTable;
  dailyMinutesChange: DailyMinutesChangeTable;
  clockCorrection: ClockCorrectionTable;
  notification: NotificationTable;
}
