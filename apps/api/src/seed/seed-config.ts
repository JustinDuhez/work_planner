import { findPasswordPolicyViolation } from '@work-planner/domain';
import { z } from 'zod';
import { ConfigurationError } from '../config/config';

export interface SeedConfig {
  adminEmail: string;
  adminPassword: string;
  demoPassword: string;
}

// Placeholder prefix of the old .env.example: such a value must never become a real password.
const PLACEHOLDER_PASSWORD_PREFIX = 'change-this-';

const policyCompliantPassword = z
  .string()
  .refine((password) => findPasswordPolicyViolation(password) === null, {
    message: 'Must contain 12 to 128 characters',
  })
  .refine((password) => !password.startsWith(PLACEHOLDER_PASSWORD_PREFIX), {
    message: `Must not be a placeholder starting with "${PLACEHOLDER_PASSWORD_PREFIX}"`,
  });

const seedEnvironmentSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_PASSWORD: policyCompliantPassword,
  DEMO_PASSWORD: policyCompliantPassword,
});

export function loadSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const result = seedEnvironmentSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigurationError(
      'INVALID_CONFIGURATION',
      `Invalid seed configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return {
    adminEmail: result.data.ADMIN_EMAIL,
    adminPassword: result.data.ADMIN_PASSWORD,
    demoPassword: result.data.DEMO_PASSWORD,
  };
}
