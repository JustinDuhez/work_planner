import { generateSecretToken, hashToken, isSameSecret } from './session-token';

describe('session tokens', () => {
  it('generates a different 256-bit token every time', () => {
    const first = generateSecretToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSecretToken()).not.toBe(first);
  });

  it('stores tokens as a SHA-256 hash that never contains the token', () => {
    const token = generateSecretToken();

    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('accepts an identical secret', () => {
    expect(isSameSecret('abc123', 'abc123')).toBe(true);
  });

  it.each([
    ['a different secret', 'abc124'],
    ['a shorter secret', 'abc'],
    ['a missing secret', undefined],
  ])('refuses %s', (_description, received) => {
    expect(isSameSecret(received, 'abc123')).toBe(false);
  });
});
