import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { AccountBlockedError, InvalidCredentialsError } from './auth-errors';
import { burnPasswordVerification, verifyPassword } from './password-hasher';

export async function authenticate(
  db: Kysely<Database>,
  credentials: { email: string; password: string },
): Promise<number> {
  const user = await db
    .selectFrom('appUser')
    .select(['id', 'passwordHash', 'isBlocked', 'archivedAt'])
    .where('email', '=', credentials.email)
    .executeTakeFirst();
  if (!user || user.archivedAt !== null) {
    await burnPasswordVerification(credentials.password);
    throw new InvalidCredentialsError();
  }
  if (!(await verifyPassword(user.passwordHash, credentials.password))) {
    throw new InvalidCredentialsError();
  }
  // Revealed only once the password is proven, so it cannot be used to probe accounts.
  if (user.isBlocked) {
    throw new AccountBlockedError();
  }
  return user.id;
}
