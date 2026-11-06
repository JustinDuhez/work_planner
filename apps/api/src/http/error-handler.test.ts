import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '@work-planner/domain';
import Fastify from 'fastify';
import { httpStatusFor, registerErrorHandlers } from './error-handler';

describe('httpStatusFor', () => {
  it.each([
    [new ValidationError('CODE', 'message'), 400],
    [new UnauthorizedError('CODE', 'message'), 401],
    [new ForbiddenError('CODE', 'message'), 403],
    [new NotFoundError('CODE', 'message'), 404],
    [new ConflictError('CODE', 'message'), 409],
    [new TooManyRequestsError('CODE', 'message'), 429],
  ])('maps %p to HTTP %i', (error, expectedStatus) => {
    expect(httpStatusFor(error)).toBe(expectedStatus);
  });

  it('maps a module-specific error through the generic class it extends', () => {
    class ClockAlreadyRunningError extends ConflictError {}

    expect(httpStatusFor(new ClockAlreadyRunningError('CLOCK_ALREADY_RUNNING', 'message'))).toBe(
      409,
    );
  });

  it('treats a bare AppError as an internal error', () => {
    expect(httpStatusFor(new AppError('CODE', 'message'))).toBe(500);
  });
});

describe('security event logs', () => {
  async function logLinesFor(error: AppError): Promise<Record<string, unknown>[]> {
    const lines: string[] = [];
    const app = Fastify({
      logger: { level: 'warn', stream: { write: (line) => lines.push(line) } },
    });
    registerErrorHandlers(app, { serveSpa: false });
    app.get('/api/v1/test-failures', () => {
      throw error;
    });
    await app.inject({ method: 'GET', url: '/api/v1/test-failures?email=secret@example.com' });
    await app.close();
    return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  it.each([
    ['INVALID_CREDENTIALS', new UnauthorizedError('INVALID_CREDENTIALS', 'm'), 'auth.login_failed'],
    ['TOO_MANY_ATTEMPTS', new TooManyRequestsError('TOO_MANY_ATTEMPTS', 'm'), 'auth.login_locked'],
    ['CSRF_INVALID', new ForbiddenError('CSRF_INVALID', 'm'), 'auth.csrf_refused'],
  ])('logs %s as a structured event without request data', async (code, error, event) => {
    const [line] = await logLinesFor(error);

    expect(line).toMatchObject({ event, code });
    expect(JSON.stringify(line)).not.toContain('secret@example.com');
  });

  it('logs nothing for an ordinary business error', async () => {
    expect(await logLinesFor(new ConflictError('CLOCK_ALREADY_RUNNING', 'm'))).toEqual([]);
  });
});
