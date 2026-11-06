import { ConflictError, ValidationError } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from './app';
import { createDb } from './db/create-db';
import type { Database } from './db/database';
import { TEST_ORIGIN } from './test/auth-helpers';
import { createTestConfig } from './test/test-config';
import { createMigratedTestDb } from './test/test-database';

const OVERSIZED_BODY_LENGTH = 1_100_000; // Fastify's default body limit is 1 MiB
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
    app.post('/api/v1/test-echoes', () => ({ received: true }));
    app.get('/api/v1/test-crash', () => {
      throw new Error('connection string postgres://secret@db leaked');
    });
    app.get('/api/v1/test-bare-validations', () => {
      throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.');
    });
    app.get('/api/v1/test-validations', () => {
      throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
        firstName: 'Prénom requis.',
      });
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

  it('answers a generic 400 for a malformed request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-echoes',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      payload: '{ not json',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toEqual({
      code: 'BAD_REQUEST',
      message: 'Requête invalide.',
    });
    expect(response.body).not.toContain('JSON');
  });

  it('sends field messages along with a validation error', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-validations' });

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Certains champs sont invalides.',
      fieldErrors: { firstName: 'Prénom requis.' },
    });
  });

  it('sends no fieldErrors key when a validation error has no field messages', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-bare-validations' });

    expect(response.statusCode).toBe(400);
    expect(response.json<unknown>()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Certains champs sont invalides.',
    });
  });

  it('answers 415 for a body type the API does not accept', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-echoes',
      headers: { 'content-type': 'text/csv', origin: TEST_ORIGIN },
      payload: 'a,b',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json<unknown>()).toEqual({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Format de requête non pris en charge.',
    });
  });

  it('answers 413 for a body above the size limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-echoes',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      payload: JSON.stringify({ data: 'x'.repeat(OVERSIZED_BODY_LENGTH) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json<unknown>()).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Requête trop volumineuse.',
    });
  });

  it('sends a strict Content Security Policy and anti-sniffing headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    const contentSecurityPolicy = String(response.headers['content-security-policy']);
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).not.toContain('unsafe-inline');
    expect(contentSecurityPolicy).not.toContain('upgrade-insecure-requests');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('asks browsers to upgrade insecure requests in production', async () => {
    const productionDb = createDb(UNREACHABLE_DATABASE_URL);
    const productionApp = await buildApp({
      config: createTestConfig({ isProduction: true }),
      db: productionDb,
    });

    const response = await productionApp.inject({ method: 'GET', url: '/api/v1/unknown' });

    expect(String(response.headers['content-security-policy'])).toContain(
      'upgrade-insecure-requests',
    );
    await productionApp.close();
    await productionDb.destroy();
  });
});
