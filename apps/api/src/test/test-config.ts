import type { AppConfig } from '../config/config';

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused',
    migrationDatabaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused',
    appTimezone: 'Europe/Paris',
    logLevel: 'silent',
    isProduction: false,
    ...overrides,
  };
}
