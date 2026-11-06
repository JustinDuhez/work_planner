import { ValidationError } from '@work-planner/domain';
import type { z } from 'zod';

/** Issues without a field path (e.g. unexpected keys) are reported for the whole form. */
export const FORM_FIELD_ERROR_KEY = 'form';

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.map(String).join('.') || FORM_FIELD_ERROR_KEY;
    fieldErrors[field] ??= issue.message;
  }
  throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', fieldErrors);
}
