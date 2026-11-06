const FIRST_PRINTABLE_CHARACTER_CODE = 0x20;

function hasControlCharacter(path: string): boolean {
  return [...path].some((character) => character.charCodeAt(0) < FIRST_PRINTABLE_CHARACTER_CODE);
}

/**
 * Only same-app absolute paths. Browsers strip tabs and newlines, so "/\t/evil.com"
 * would become the protocol-relative "//evil.com": control characters are refused too.
 */
export function isSafeRedirectPath(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !hasControlCharacter(path)
  );
}
