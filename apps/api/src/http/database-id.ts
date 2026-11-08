import { z } from 'zod';

// Postgres INTEGER ceiling: a larger id would crash the query instead of failing validation.
const MAX_DATABASE_ID = 2_147_483_647;

export function databaseIdSchema(message: string) {
  return z.coerce.number().int().positive(message).max(MAX_DATABASE_ID, message);
}
