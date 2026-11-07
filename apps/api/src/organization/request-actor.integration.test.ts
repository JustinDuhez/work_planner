import type { FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { insertTeam, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import { getActor } from './request-actor';

function requestFor(user: { id: number; isAdmin: boolean }): FastifyRequest {
  return { authSession: { sessionId: 1, csrfToken: 'x', user } } as unknown as FastifyRequest;
}

describe('getActor', () => {
  let db: Kysely<Database>;
  let managerId: number;
  let memberId: number;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    managerId = await insertUser(db, { email: 'actor.manager@example.com' });
    memberId = await insertUser(db, { email: 'actor.member@example.com' });
    await insertTeam(db, { name: 'Actor team', managerId, memberIds: [memberId] });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('builds the policy actor of the logged-in user', async () => {
    const actor = await getActor(requestFor({ id: managerId, isAdmin: false }), db);

    expect(actor).toMatchObject({ id: managerId, isManager: true });
    expect(actor.managedUserIds).toEqual(new Set([memberId]));
  });

  it('loads the actor once per request, however many times a route asks', async () => {
    const request = requestFor({ id: memberId, isAdmin: false });

    const first = getActor(request, db);
    expect(getActor(request, db)).toBe(first);
    await first;
  });

  it('refuses a request without a session', async () => {
    const anonymous = { authSession: null } as unknown as FastifyRequest;

    await expect(getActor(anonymous, db)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
