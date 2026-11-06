import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '@work-planner/domain';
import { httpStatusFor } from './error-handler';

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
