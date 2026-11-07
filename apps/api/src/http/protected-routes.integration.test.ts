import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { TEST_ORIGIN } from '../test/auth-helpers';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';
import { PUBLIC_API_ROUTES } from './protected-routes';

const SAMPLE_PARAMS: Record<string, string> = {
  id: '1',
  userId: '1',
  isoWeek: '2026-W45',
  date: '2026-11-06',
};

function withSampleParams(url: string): string {
  return url.replace(/:(\w+)/g, (_match, name: string) => SAMPLE_PARAMS[name] ?? '1');
}

describe('route protection', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    app = await buildApp({ config: createTestConfig(), db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('knows the API routes it registered', () => {
    expect(app.registeredApiRoutes.length).toBeGreaterThan(PUBLIC_API_ROUTES.size);
  });

  it('answers 401 without a session on every API route except the public ones', async () => {
    const unprotected: string[] = [];
    for (const { method, url } of app.registeredApiRoutes) {
      if (PUBLIC_API_ROUTES.has(`${method} ${url}`) || method === 'HEAD') continue;
      const response = await app.inject({
        method: method as 'GET',
        url: withSampleParams(url),
        headers: { origin: TEST_ORIGIN },
      });
      if (response.statusCode !== 401)
        unprotected.push(`${method} ${url} → ${response.statusCode}`);
    }

    expect(unprotected).toEqual([]);
  });
});
