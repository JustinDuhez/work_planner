import { AppError, errorResponseSchema } from '@work-planner/domain';
import type { z } from 'zod';
import { copy } from '../copy';

const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';
const UNKNOWN_ERROR_MESSAGE = 'Une erreur inattendue est survenue.';

type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let csrfToken: string | undefined;

export class ApiError extends AppError {
  readonly status: number;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(code, message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Set from every session answer; sent on every write so the API can refuse forged requests. */
export function setCsrfToken(token: string | undefined): void {
  csrfToken = token;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const error = errorResponseSchema.safeParse(await readJsonBody(response));
  return error.success
    ? new ApiError(response.status, error.data.code, error.data.message, error.data.fieldErrors)
    : new ApiError(response.status, UNKNOWN_ERROR_CODE, UNKNOWN_ERROR_MESSAGE);
}

// fetch only rejects when the request never got an answer (offline, DNS, server down).
async function fetchOrNetworkError(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new ApiError(0, NETWORK_ERROR_CODE, copy.errors.network);
  }
}

export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetchOrNetworkError(path, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return schema.parse(await readJsonBody(response));
}

async function send(method: WriteMethod, path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken !== undefined) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetchOrNetworkError(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

export async function apiSend<T>(
  method: WriteMethod,
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await send(method, path, body);
  return schema.parse(await readJsonBody(response));
}

export async function apiSendNoContent(
  method: WriteMethod,
  path: string,
  body?: unknown,
): Promise<void> {
  await send(method, path, body);
}
