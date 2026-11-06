import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { DEFAULT_TEST_PASSWORD, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import { AccountBlockedError, InvalidCredentialsError } from './auth-errors';
import { authenticate } from './authenticate';

describe('authenticate', () => {
  let db: Kysely<Database>;
  let aliceId: number;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    aliceId = await insertUser(db, { email: 'alice@example.com' });
    await insertUser(db, { email: 'blocked@example.com', isBlocked: true });
    await insertUser(db, { email: 'archived@example.com', isArchived: true });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns the user id for the right email and password', async () => {
    await expect(
      authenticate(db, { email: 'alice@example.com', password: DEFAULT_TEST_PASSWORD }),
    ).resolves.toBe(aliceId);
  });

  it.each([
    ['a wrong password', 'alice@example.com', 'wrong password!!'],
    ['an unknown email', 'nobody@example.com', DEFAULT_TEST_PASSWORD],
    ['an archived account', 'archived@example.com', DEFAULT_TEST_PASSWORD],
  ])('refuses %s with the same generic error', async (_description, email, password) => {
    await expect(authenticate(db, { email, password })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('tells a blocked user their account is blocked once the password is proven', async () => {
    await expect(
      authenticate(db, { email: 'blocked@example.com', password: DEFAULT_TEST_PASSWORD }),
    ).rejects.toBeInstanceOf(AccountBlockedError);
  });

  it('does not reveal that an account is blocked to someone without the password', async () => {
    await expect(
      authenticate(db, { email: 'blocked@example.com', password: 'wrong password!!' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
