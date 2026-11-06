import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTE_LENGTH = 32;

export function generateSecretToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison: the time taken must not reveal how many characters matched. */
export function isSameSecret(received: string | undefined, expected: string): boolean {
  if (received === undefined) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}
