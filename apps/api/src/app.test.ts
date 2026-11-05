import { ConflictError } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from './app';
import { createDb } from './db/create-db';
import type { Database } from './db/database';
import { createTestConfig } from './test/test-config';
import { createMigratedTestDb } from './test/test-database';

const UNREACHABLE_DATABASE_URL = 'postgres://unused:unused@127.0.0.1:1/unused';
const UNREACHABLE_DATABASE_TIMEOUT_IN_MILLISECONDS = 15_000;

describe('API application', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    app = await buildApp({ config: createTestConfig(), db });
    app.get('/api/v1/test-conflict', () => {
      throw new ConflictError('CLOCK_ALREADY_RUNNING', 'Une période est déjà en cours.');
    });
    app.get('/api/v1/test-crash', () => {
      throw new Error('connection string postgres://secret@db leaked');
    });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('reports the service and its database as healthy', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toEqual({ status: 'ok', database: 'up' });
  });

  it(
    'answers 503 when the database cannot be reached',
    async () => {
      const unreachableDb = createDb(UNREACHABLE_DATABASE_URL);
      const appWithoutDatabase = await buildApp({ config: createTestConfig(), db: unreachableDb });

      const response = await appWithoutDatabase.inject({ method: 'GET', url: '/api/v1/health' });

      expect(response.statusCode).toBe(503);
      expect(response.json<unknown>()).toEqual({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Base de données indisponible.',
      });
      await appWithoutDatabase.close();
      await unreachableDb.destroy();
    },
    UNREACHABLE_DATABASE_TIMEOUT_IN_MILLISECONDS,
  );

  it('answers a JSON 404 for an unknown API route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/unknown-resources' });

    expect(response.statusCode).toBe(404);
    expect(response.json<unknown>()).toEqual({
      code: 'NOT_FOUND',
      message: 'Ressource introuvable.',
    });
  });

  it('turns a business error into its HTTP status with its code and message', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json<unknown>()).toEqual({
      code: 'CLOCK_ALREADY_RUNNING',
      message: 'Une période est déjà en cours.',
    });
  });

  it('hides the details of an unexpected error behind a generic 500', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-crash' });

    expect(response.statusCode).toBe(500);
    expect(response.json<unknown>()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue.',
    });
    expect(response.body).not.toContain('secret');
  });

  it('sends a strict Content Security Policy and anti-sniffing headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    const contentSecurityPolicy = String(response.headers['content-security-policy']);
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).not.toContain('unsafe-inline');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
