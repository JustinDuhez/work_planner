import { isSafeRedirectPath } from './safe-redirect';

describe('isSafeRedirectPath', () => {
  it.each(['/', '/profil', '/calendrier?mois=2026-11', '/equipe#alice'])(
    'accepts the in-app path %s',
    (path) => {
      expect(isSafeRedirectPath(path)).toBe(true);
    },
  );

  it.each([
    ['a protocol-relative URL', '//evil.com'],
    ['an absolute URL', 'https://evil.com'],
    ['a backslash trick', '/\\evil.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'profil'],
    ['an empty string', ''],
    ['a tab that browsers strip into //', '/\t/evil.com'],
  ])('refuses %s', (_description, path) => {
    expect(isSafeRedirectPath(path)).toBe(false);
  });
});
