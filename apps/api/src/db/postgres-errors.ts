const UNIQUE_VIOLATION = '23505';

/** Unique-index conflicts are the database's last word when two writers race on the same key. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === UNIQUE_VIOLATION
  );
}
