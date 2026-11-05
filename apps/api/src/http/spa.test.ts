import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import { createDb } from '../db/create-db';
import type { Database } from '../db/database';
import { createTestConfig } from '../test/test-config';

const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const HASHED_ASSET = 'assets/index-a1b2c3.js';

describe('single-page app serving', () => {
  let webDistDirectory: string;
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    webDistDirectory = await mkdtemp(path.join(tmpdir(), 'web-dist-'));
    await mkdir(path.join(webDistDirectory, 'assets'));
    await writeFile(path.join(webDistDirectory, 'index.html'), INDEX_HTML);
    await writeFile(path.join(webDistDirectory, HASHED_ASSET), 'console.log("app");');

    const config = createTestConfig();
    db = createDb(config.databaseUrl);
    app = await buildApp({ config, db, webDistDirectory });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
    await rm(webDistDirectory, { recursive: true, force: true });
  });

  it('serves the app page for a client-side route so deep links work', async () => {
    const response = await app.inject({ method: 'GET', url: '/calendrier' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toBe(INDEX_HTML);
  });

  it('never caches the app page, so a new deployment is picked up at once', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed assets for a year because their name changes with their content', async () => {
    const response = await app.inject({ method: 'GET', url: `/${HASHED_ASSET}` });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps answering JSON 404 for unknown API routes instead of the app page', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/unknown-resources' });

    expect(response.statusCode).toBe(404);
    expect(response.json<unknown>()).toEqual({
      code: 'NOT_FOUND',
      message: 'Ressource introuvable.',
    });
  });

  it('protects the app page with the Content Security Policy', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(String(response.headers['content-security-policy'])).toContain("default-src 'self'");
  });
});
