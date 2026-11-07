import type { WorkMode } from '@work-planner/domain';
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

export interface Database {
  setting: SettingTable;
  appUser: AppUserTable;
  session: SessionTable;
  team: TeamTable;
  teamMember: TeamMemberTable;
  clockDay: ClockDayTable;
  clockPeriod: ClockPeriodTable;
}
