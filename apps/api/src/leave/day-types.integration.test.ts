import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn } from '../test/auth-helpers';
import { insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

describe('day types', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    await insertUser(db, { email: 'lea.types@example.com' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock().now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lists the 8 day types with their rules', async () => {
    const { cookie } = await logIn(app, 'lea.types@example.com');

    const types = (
      await app.inject({ method: 'GET', url: '/api/v1/day-types', headers: { cookie } })
    ).json<
      { code: string; isBadgeable: boolean; isRequestable: boolean; requiresApproval: boolean }[]
    >();

    expect(types.map((type) => type.code)).toEqual([
      'on_site',
      'telework',
      'telework_week',
      'recovery',
      'sick',
      'leave',
      'training_travel',
      'early_departure',
    ]);
    expect(types.find((type) => type.code === 'telework')).toMatchObject({
      isBadgeable: true,
      isRequestable: true,
    });
    expect(types.find((type) => type.code === 'leave')).toMatchObject({
      isBadgeable: false,
      requiresApproval: true,
    });
    expect(types.filter((type) => type.isRequestable).map((type) => type.code)).toEqual([
      'telework',
      'recovery',
      'sick',
      'leave',
      'training_travel',
      'early_departure',
    ]);
  });
});
