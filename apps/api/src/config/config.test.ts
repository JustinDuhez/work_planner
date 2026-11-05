import { loadConfig } from './config';

const VALID_DATABASE_URL = 'postgres://user:password@localhost:5432/work_planner';

describe('loadConfig', () => {
  it('applies safe defaults when only the database URL is provided', () => {
    const config = loadConfig({ DATABASE_URL: VALID_DATABASE_URL });

    expect(config).toEqual({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 3001,
      databaseUrl: VALID_DATABASE_URL,
      appTimezone: 'Europe/Paris',
      logLevel: 'info',
      isProduction: false,
    });
  });

  it('reads the port as a number and flags production mode', () => {
    const config = loadConfig({
      DATABASE_URL: VALID_DATABASE_URL,
      NODE_ENV: 'production',
      PORT: '10000',
    });

    expect(config.port).toBe(10000);
    expect(config.isProduction).toBe(true);
  });

  it('refuses to start without a database URL and names the missing variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('refuses a database URL that is not PostgreSQL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://user:password@localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuses an unknown time zone', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: VALID_DATABASE_URL, APP_TIMEZONE: 'Mars/Olympus_Mons' }),
    ).toThrow(/APP_TIMEZONE/);
  });

  it('never echoes secret values in the error message', () => {
    const loadWithSecretInUrl = () =>
      loadConfig({ DATABASE_URL: 'not-a-url-with-s3cr3t-password' });

    expect(loadWithSecretInUrl).toThrow(/DATABASE_URL/);
    expect(loadWithSecretInUrl).not.toThrow(/s3cr3t/);
  });
});
