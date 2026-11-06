import { z } from 'zod';

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
