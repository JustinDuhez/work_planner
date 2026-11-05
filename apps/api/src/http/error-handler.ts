import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type ErrorResponse,
} from '@work-planner/domain';
import type {} from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const INTERNAL_ERROR: ErrorResponse = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue.',
};
const BAD_REQUEST: ErrorResponse = { code: 'BAD_REQUEST', message: 'Requête invalide.' };
const NOT_FOUND: ErrorResponse = { code: 'NOT_FOUND', message: 'Ressource introuvable.' };

export function httpStatusFor(error: AppError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  return 500;
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
      const body: ErrorResponse = { code: error.code, message: error.message };
      return reply.status(httpStatusFor(error)).send(body);
    }
    if (isClientError(error)) {
      return reply.status(error.statusCode).send(BAD_REQUEST);
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
