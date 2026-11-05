import { assertIsTestDatabaseUrl } from './test-database';

describe('assertIsTestDatabaseUrl', () => {
  it('refuses when the test database url is missing', () => {
    expect(() => assertIsTestDatabaseUrl(undefined)).toThrow('TEST_DATABASE_URL is not set');
  });

  it('refuses a url whose database is not a test database', () => {
    expect(() => assertIsTestDatabaseUrl('postgres://u:p@localhost:5432/work_planner')).toThrow(
      'must name a database ending with "_test"',
    );
  });

  it('refuses a url that only mentions _test in its query string', () => {
    expect(() =>
      assertIsTestDatabaseUrl('postgres://u:p@localhost:5432/work_planner?x=_test'),
    ).toThrow('must name a database ending with "_test"');
  });

  it('accepts a url whose database name ends with _test', () => {
    const url = 'postgres://u:p@localhost:5432/work_planner_test';

    expect(assertIsTestDatabaseUrl(url)).toBe(url);
  });
});
