import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Kysely } from 'kysely';
import type { AppConfig } from './config/config';
import type { Database } from './db/database';
import { registerHealthRoutes } from './health/health-routes';
import { registerErrorHandlers } from './http/error-handler';
import { registerSecurityHeaders } from './http/security-headers';
import { registerSpa } from './http/spa';

export interface AppDependencies {
  config: AppConfig;
  db: Kysely<Database>;
  webDistDirectory?: string;
}

function buildLoggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  if (config.nodeEnv === 'test') {
    return false;
  }
  if (config.isProduction) {
    return { level: config.logLevel };
  }
  return { level: config.logLevel, transport: { target: 'pino-pretty' } };
}

export async function buildApp({
  config,
  db,
  webDistDirectory,
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: buildLoggerOptions(config) });

  await registerSecurityHeaders(app, config.isProduction);
  registerErrorHandlers(app, { serveSpa: webDistDirectory !== undefined });
  registerHealthRoutes(app, db);
  if (webDistDirectory !== undefined) {
    await registerSpa(app, webDistDirectory);
  }

  return app;
}
