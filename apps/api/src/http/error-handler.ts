import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
  type ErrorResponse,
} from '@work-planner/domain';
import type {} from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNSUPPORTED_MEDIA_TYPE_STATUS = 415;

const INTERNAL_ERROR: ErrorResponse = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue.',
};
const BAD_REQUEST: ErrorResponse = { code: 'BAD_REQUEST', message: 'Requête invalide.' };
const NOT_FOUND: ErrorResponse = { code: 'NOT_FOUND', message: 'Ressource introuvable.' };
const CLIENT_ERROR_BY_STATUS: ReadonlyMap<number, ErrorResponse> = new Map([
  [PAYLOAD_TOO_LARGE_STATUS, { code: 'PAYLOAD_TOO_LARGE', message: 'Requête trop volumineuse.' }],
  [
    UNSUPPORTED_MEDIA_TYPE_STATUS,
    { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Format de requête non pris en charge.' },
  ],
]);

// OWASP A09: authentication failures are logged as structured events, by error code, so the
// log never needs the email, password, cookie or token of the request.
const SECURITY_EVENT_BY_CODE: ReadonlyMap<string, string> = new Map([
  ['INVALID_CREDENTIALS', 'auth.login_failed'],
  ['TOO_MANY_ATTEMPTS', 'auth.login_locked'],
  ['CSRF_INVALID', 'auth.csrf_refused'],
]);

export function httpStatusFor(error: AppError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof TooManyRequestsError) return 429;
  return 500;
}

function toErrorResponse(error: AppError): ErrorResponse {
  if (error instanceof ValidationError && error.fieldErrors !== undefined) {
    return { code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  return { code: error.code, message: error.message };
}

function isClientError(error: unknown): error is { statusCode: number } {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return false;
  }
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

export function registerErrorHandlers(
  app: FastifyInstance,
  { serveSpa }: { serveSpa: boolean },
): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError && httpStatusFor(error) < 500) {
      const securityEvent = SECURITY_EVENT_BY_CODE.get(error.code);
      if (securityEvent !== undefined) {
        request.log.warn({ event: securityEvent, code: error.code }, 'Security event');
      }
      return reply.status(httpStatusFor(error)).send(toErrorResponse(error));
    }
    if (isClientError(error)) {
      return reply
        .status(error.statusCode)
        .send(CLIENT_ERROR_BY_STATUS.get(error.statusCode) ?? BAD_REQUEST);
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send(INTERNAL_ERROR);
  });

  app.setNotFoundHandler((request, reply) => {
    const isPageNavigation = request.method === 'GET' && !request.url.startsWith('/api/');
    if (serveSpa && isPageNavigation) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.status(404).send(NOT_FOUND);
  });
}
