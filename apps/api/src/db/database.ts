import type { Generated } from 'kysely';

export interface SettingTable {
  id: Generated<number>;
  key: string;
  value: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface Database {
  setting: SettingTable;
}
