import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

describe('AppError hierarchy', () => {
  it.each([
    ['ValidationError', ValidationError],
    ['UnauthorizedError', UnauthorizedError],
    ['ForbiddenError', ForbiddenError],
    ['NotFoundError', NotFoundError],
    ['ConflictError', ConflictError],
  ])('a %s is an AppError that keeps its code, message and class name', (name, ErrorClass) => {
    const error = new ErrorClass('SOME_CODE', 'Un message lisible');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('SOME_CODE');
    expect(error.message).toBe('Un message lisible');
    expect(error.name).toBe(name);
  });

  it('lets a module declare its own error by extending a generic one', () => {
    class ClockAlreadyRunningError extends ConflictError {}

    const error = new ClockAlreadyRunningError('CLOCK_ALREADY_RUNNING', 'Déjà en cours');

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.name).toBe('ClockAlreadyRunningError');
  });
});
