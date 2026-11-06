export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
const STRONG_PASSWORD_LENGTH = 16;
const STRONG_PASSWORD_CHARACTER_CLASS_COUNT = 3;
const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/];

export type PasswordPolicyViolation = 'TOO_SHORT' | 'TOO_LONG' | 'SAME_AS_CURRENT';
export type PasswordStrength = 'weak' | 'fair' | 'strong';

export const PASSWORD_POLICY_MESSAGES: Record<PasswordPolicyViolation, string> = {
  TOO_SHORT: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  TOO_LONG: `Le mot de passe doit contenir au plus ${MAX_PASSWORD_LENGTH} caractères.`,
  SAME_AS_CURRENT: "Le nouveau mot de passe doit être différent de l'actuel.",
};

// Code points, not UTF-16 units: an emoji counts as one character for the user.
function countCharacters(password: string): number {
  return [...password].length;
}

export function findPasswordPolicyViolation(
  newPassword: string,
  currentPassword?: string,
): PasswordPolicyViolation | null {
  const length = countCharacters(newPassword);
  if (length < MIN_PASSWORD_LENGTH) return 'TOO_SHORT';
  if (length > MAX_PASSWORD_LENGTH) return 'TOO_LONG';
  if (newPassword === currentPassword) return 'SAME_AS_CURRENT';
  return null;
}

export function estimatePasswordStrength(password: string): PasswordStrength {
  const length = countCharacters(password);
  if (length < MIN_PASSWORD_LENGTH) return 'weak';
  const characterClassCount = CHARACTER_CLASSES.filter((pattern) => pattern.test(password)).length;
  if (
    length >= STRONG_PASSWORD_LENGTH ||
    characterClassCount >= STRONG_PASSWORD_CHARACTER_CLASS_COUNT
  ) {
    return 'strong';
  }
  return 'fair';
}
