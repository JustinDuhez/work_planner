import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
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
    ['TooManyRequestsError', TooManyRequestsError],
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

describe('ValidationError', () => {
  it('carries per-field messages for forms', () => {
    const error = new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
      firstName: 'Prénom requis.',
    });

    expect(error.fieldErrors).toEqual({ firstName: 'Prénom requis.' });
  });

  it('has no field messages when none are given', () => {
    expect(new ValidationError('CODE', 'message').fieldErrors).toBeUndefined();
  });
});
