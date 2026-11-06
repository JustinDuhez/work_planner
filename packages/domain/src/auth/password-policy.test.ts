import {
  estimatePasswordStrength,
  findPasswordPolicyViolation,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './password-policy';

describe('findPasswordPolicyViolation', () => {
  it('refuses a password one character shorter than the minimum', () => {
    expect(findPasswordPolicyViolation('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe('TOO_SHORT');
  });

  it('accepts a password of exactly the minimum length', () => {
    expect(findPasswordPolicyViolation('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('accepts a password of exactly the maximum length', () => {
    expect(findPasswordPolicyViolation('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull();
  });

  it('refuses a password one character longer than the maximum', () => {
    expect(findPasswordPolicyViolation('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe('TOO_LONG');
  });

  it('counts an emoji as one character, not as its UTF-16 length', () => {
    expect(findPasswordPolicyViolation('🔒'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(findPasswordPolicyViolation('🔒'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe('TOO_SHORT');
  });

  it('refuses reusing the current password', () => {
    const password = 'correct horse battery staple';

    expect(findPasswordPolicyViolation(password, password)).toBe('SAME_AS_CURRENT');
  });

  it('accepts a new password that differs from the current one', () => {
    expect(
      findPasswordPolicyViolation('another long passphrase', 'correct horse battery staple'),
    ).toBeNull();
  });
});

describe('estimatePasswordStrength', () => {
  it('rates a password below the minimum length as weak', () => {
    expect(estimatePasswordStrength('Ab1!')).toBe('weak');
  });

  it('rates a long-enough password made of one character class as fair', () => {
    expect(estimatePasswordStrength('abcdefghijkl')).toBe('fair');
  });

  it('rates a long-enough password mixing three character classes as strong', () => {
    expect(estimatePasswordStrength('abcdefgh12!X')).toBe('strong');
  });

  it('rates a 16-character passphrase as strong even with one character class', () => {
    expect(estimatePasswordStrength('correcthorsebatt')).toBe('strong');
  });
});
