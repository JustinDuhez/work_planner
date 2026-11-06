import { loadSeedConfig } from './seed-config';

const VALID_ENVIRONMENT = {
  ADMIN_EMAIL: ' Admin@Example.com ',
  ADMIN_PASSWORD: 'an admin passphrase',
  DEMO_PASSWORD: 'a demo passphrase',
};

describe('loadSeedConfig', () => {
  it('reads the admin and demo credentials, normalizing the email', () => {
    expect(loadSeedConfig(VALID_ENVIRONMENT)).toEqual({
      adminEmail: 'admin@example.com',
      adminPassword: 'an admin passphrase',
      demoPassword: 'a demo passphrase',
    });
  });

  it.each(['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DEMO_PASSWORD'])(
    'refuses to run without %s',
    (name) => {
      expect(() => loadSeedConfig({ ...VALID_ENVIRONMENT, [name]: undefined })).toThrow(name);
    },
  );

  it('refuses a seed password that breaks the password policy', () => {
    expect(() => loadSeedConfig({ ...VALID_ENVIRONMENT, DEMO_PASSWORD: 'short' })).toThrow(
      /DEMO_PASSWORD/,
    );
  });

  it('never echoes the passwords in its error', () => {
    expect(() => loadSeedConfig({ ...VALID_ENVIRONMENT, ADMIN_PASSWORD: 's3cr3t' })).not.toThrow(
      /s3cr3t/,
    );
  });
});
