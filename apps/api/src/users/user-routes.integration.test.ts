import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertUser } from '../test/fixtures';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

describe('GET /api/v1/users', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: 'zoe.adam@example.com', firstName: 'Zoé', lastName: 'Adam' });
    await insertUser(db, { email: 'bob.martin@example.com', firstName: 'Bob', lastName: 'Martin' });
    await insertUser(db, {
      email: 'alice.martin@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
    });
    await insertUser(db, {
      email: 'gone@example.com',
      firstName: 'Gone',
      lastName: 'Away',
      isArchived: true,
    });
    app = await buildApp({ config: createTestConfig(), db });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists active people by last then first name, without archived ones', async () => {
    const { cookie } = await logIn(app, 'bob.martin@example.com');

    const response = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ firstName: string }[]>().map((user) => user.firstName)).toEqual([
      'Zoé',
      'Alice',
      'Bob',
    ]);
  });

  it('never exposes password hashes', async () => {
    const { cookie } = await logIn(app, 'bob.martin@example.com');

    const response = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } });

    expect(response.body).not.toMatch(/passwordHash|argon2/);
  });
});
