import { burnPasswordVerification, hashPassword, verifyPassword } from './password-hasher';

describe('password hasher', () => {
  it('hashes with argon2id at the OWASP minimum cost', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('never stores the password itself', async () => {
    expect(await hashPassword('correct horse battery staple')).not.toContain('correct horse');
  });

  it('accepts the right password', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword(passwordHash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword(passwordHash, 'wrong horse battery staple')).resolves.toBe(false);
  });

  it('salts every hash, so two users with the same password get different hashes', async () => {
    expect(await hashPassword('same password here')).not.toBe(
      await hashPassword('same password here'),
    );
  });

  it('spends a verification without failing, to answer unknown emails in the same time', async () => {
    await expect(burnPasswordVerification('whatever was typed')).resolves.toBeUndefined();
  });
});
