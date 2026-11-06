import argon2 from 'argon2';

// OWASP Password Storage Cheat Sheet minimum for argon2id.
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
const TIMING_EQUALIZATION_PASSWORD = 'timing-equalization-only';

let timingEqualizationHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

/**
 * Runs a full verification against a throwaway hash so that "unknown email" takes as long
 * as "wrong password": response time must not reveal which emails have an account.
 */
export async function burnPasswordVerification(password: string): Promise<void> {
  timingEqualizationHash ??= hashPassword(TIMING_EQUALIZATION_PASSWORD);
  await argon2.verify(await timingEqualizationHash, password);
}
