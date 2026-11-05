import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadDotEnvIfPresent } from './load-env';

const LOADED_VARIABLE = 'WORK_PLANNER_LOAD_ENV_TEST_LOADED';
const PRESET_VARIABLE = 'WORK_PLANNER_LOAD_ENV_TEST_PRESET';

describe('loadDotEnvIfPresent', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'work-planner-env-'));
  });

  afterEach(() => {
    delete process.env[LOADED_VARIABLE];
    delete process.env[PRESET_VARIABLE];
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('loads the variables of an existing env file', () => {
    const filePath = join(temporaryDirectory, '.env');
    writeFileSync(filePath, `${LOADED_VARIABLE}=loaded-value\n`);

    loadDotEnvIfPresent(filePath);

    expect(process.env[LOADED_VARIABLE]).toBe('loaded-value');
  });

  it('does nothing when the env file does not exist', () => {
    const missingFilePath = join(temporaryDirectory, 'missing.env');

    expect(() => loadDotEnvIfPresent(missingFilePath)).not.toThrow();
    expect(process.env[LOADED_VARIABLE]).toBeUndefined();
  });

  it('keeps a variable that is already set instead of overwriting it with the file value', () => {
    const filePath = join(temporaryDirectory, '.env');
    writeFileSync(filePath, `${PRESET_VARIABLE}=from-file\n`);
    process.env[PRESET_VARIABLE] = 'from-host';

    loadDotEnvIfPresent(filePath);

    expect(process.env[PRESET_VARIABLE]).toBe('from-host');
  });
});
