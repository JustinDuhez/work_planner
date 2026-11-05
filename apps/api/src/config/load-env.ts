import { existsSync } from 'node:fs';

/** In production the host injects variables; locally they come from apps/api/.env. */
export function loadDotEnvIfPresent(filePath = '.env'): void {
  if (existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}
