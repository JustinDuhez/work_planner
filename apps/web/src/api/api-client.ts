import { AppError, errorResponseSchema } from '@work-planner/domain';
import type { z } from 'zod';

const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';
const UNKNOWN_ERROR_MESSAGE = 'Une erreur inattendue est survenue.';

export class ApiError extends AppError {
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(code, message);
    this.status = status;
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  const body = await readJsonBody(response);

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body);
    throw error.success
      ? new ApiError(response.status, error.data.code, error.data.message)
      : new ApiError(response.status, UNKNOWN_ERROR_CODE, UNKNOWN_ERROR_MESSAGE);
  }
  return schema.parse(body);
}
