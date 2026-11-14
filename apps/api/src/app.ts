import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Kysely } from 'kysely';
import { registerAuth } from './auth/auth-plugin';
import { LoginFailureLimiter } from './auth/login-failure-limiter';
import { burnPasswordVerification } from './auth/password-hasher';
import { registerMeRoutes } from './auth/me-routes';
import { registerSessionRoutes } from './auth/session-routes';
import { registerClockRoutes } from './clock/clock-routes';
import { registerCorrectionRoutes } from './corrections/correction-routes';
import { registerCounterRoutes } from './counters/counter-routes';
import type { AppConfig } from './config/config';
import type { Database } from './db/database';
import { registerHolidayRoutes } from './holidays/holiday-routes';
import { registerLeaveRoutes } from './leave/leave-routes';
import { registerPlanningRoutes } from './planning/planning-routes';
import { registerHealthRoutes } from './health/health-routes';
import { registerNotificationRoutes } from './notifications/notification-routes';
import { registerErrorHandlers } from './http/error-handler';
import { registerProtectedRoutes } from './http/protected-routes';
import { registerSecurityHeaders } from './http/security-headers';
import { registerSpa } from './http/spa';
import { registerSettingsRoutes } from './settings/settings-routes';
import { registerTeamRoutes } from './teams/team-routes';
import { registerUserRoutes } from './users/user-routes';

declare module 'fastify' {
  interface FastifyInstance {
    registeredApiRoutes: { method: string; url: string }[];
  }
}

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
  // Trust exactly the hops of our own hosting proxy (client IP for rate limits, protocol for
  // the Origin check), never the X-Forwarded-For entries a client writes itself.
  const app = Fastify({
    logger: buildLoggerOptions(config),
    trustProxy: (_address: string, hopIndex: number) => hopIndex < config.trustedProxyHopCount,
  });
  app.decorate('registeredApiRoutes', []);
  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/')) return;
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) app.registeredApiRoutes.push({ method, url: route.url });
  });
  const authDependencies = { db, now, isProduction: config.isProduction };
  const clockDependencies = { db, now, timeZone: config.appTimezone };

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
  await registerProtectedRoutes(app, (scope) => {
    registerMeRoutes(scope, authDependencies);
    registerUserRoutes(scope, clockDependencies);
    registerTeamRoutes(scope, { db });
    registerHolidayRoutes(scope, { db });
    registerSettingsRoutes(scope, { db });
    registerClockRoutes(scope, clockDependencies);
    registerCounterRoutes(scope, clockDependencies);
    registerLeaveRoutes(scope, clockDependencies);
    registerPlanningRoutes(scope, clockDependencies);
    registerCorrectionRoutes(scope, clockDependencies);
    registerNotificationRoutes(scope, { db, now });
  });
  if (webDistDirectory !== undefined) {
    await registerSpa(app, webDistDirectory);
  }

  return app;
}
