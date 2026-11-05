import { AppError } from '@work-planner/domain';
import { z } from 'zod';

const DEFAULT_PORT = 3001;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  appTimezone: string;
  logLevel: LogLevel;
  isProduction: boolean;
}

export class ConfigurationError extends AppError {}

function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_TIMEZONE: z.string().refine(isKnownTimeZone, 'Unknown time zone').default('Europe/Paris'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigurationError(
      'INVALID_CONFIGURATION',
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  const environment = result.data;
  return {
    nodeEnv: environment.NODE_ENV,
    host: environment.HOST,
    port: environment.PORT,
    databaseUrl: environment.DATABASE_URL,
    appTimezone: environment.APP_TIMEZONE,
    logLevel: environment.LOG_LEVEL,
    isProduction: environment.NODE_ENV === 'production',
  };
}
