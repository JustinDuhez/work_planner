import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Kysely } from 'kysely';
import { registerAuth } from './auth/auth-plugin';
import { LoginFailureLimiter } from './auth/login-failure-limiter';
import { burnPasswordVerification } from './auth/password-hasher';
import { registerSessionRoutes } from './auth/session-routes';
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
  now?: () => Date;
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
  now = () => new Date(),
}: AppDependencies): Promise<FastifyInstance> {
  // Render terminates TLS in front of the app: trust its X-Forwarded-* headers for the
  // client IP (rate limits) and the protocol (Origin check), in production only.
  const app = Fastify({ logger: buildLoggerOptions(config), trustProxy: config.isProduction });
  const authDependencies = { db, now, isProduction: config.isProduction };

  await registerSecurityHeaders(app, config.isProduction);
  registerErrorHandlers(app, { serveSpa: webDistDirectory !== undefined });
  await registerAuth(app, authDependencies);
  // Pre-compute the timing-equalization hash so the very first unknown-email login
  // does not take twice as long as a wrong password.
  await burnPasswordVerification('warm-up');
  registerHealthRoutes(app, db);
  registerSessionRoutes(app, {
    ...authDependencies,
    loginFailureLimiter: new LoginFailureLimiter(now),
  });
  if (webDistDirectory !== undefined) {
    await registerSpa(app, webDistDirectory);
  }

  return app;
}
