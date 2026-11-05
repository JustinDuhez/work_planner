import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** In production the host injects variables; locally they come from apps/api/.env. Variables already set win. */
export function loadDotEnvIfPresent(filePath = '.env'): void {
  if (!existsSync(filePath)) {
    return;
  }
  const variables = parseEnv(readFileSync(filePath, 'utf8'));
  for (const [name, value] of Object.entries(variables)) {
    process.env[name] ??= value;
  }
}
