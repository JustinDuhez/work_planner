import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const VARIABLE_NAME = 'WORK_PLANNER_LOAD_ENV_TEST_VARIABLE';
const LOAD_ENV_MODULE_URL = pathToFileURL(join(process.cwd(), 'src/config/load-env.ts')).href;

/**
 * Jest gives each test file a private copy of process.env, so process.loadEnvFile cannot be
 * observed in-process. A child Node process (which strips TypeScript types natively) sees the real one.
 */
function readVariableAfterLoading(filePath: string): string {
  const script = `
    import { loadDotEnvIfPresent } from ${JSON.stringify(LOAD_ENV_MODULE_URL)};
    loadDotEnvIfPresent(${JSON.stringify(filePath)});
    process.stdout.write(process.env[${JSON.stringify(VARIABLE_NAME)}] ?? 'UNSET');
  `;
  return execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
  });
}

describe('loadDotEnvIfPresent', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'work-planner-env-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('loads the variables of an existing env file', () => {
    const filePath = join(temporaryDirectory, '.env');
    writeFileSync(filePath, `${VARIABLE_NAME}=loaded-value\n`);

    expect(readVariableAfterLoading(filePath)).toBe('loaded-value');
  });

  it('does nothing when the env file does not exist', () => {
    const missingFilePath = join(temporaryDirectory, 'missing.env');

    expect(readVariableAfterLoading(missingFilePath)).toBe('UNSET');
  });
});
