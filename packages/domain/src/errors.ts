export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export type FieldErrors = Readonly<Record<string, string>>;

export class ValidationError extends AppError {
  readonly fieldErrors: FieldErrors | undefined;

  constructor(code: string, message: string, fieldErrors?: FieldErrors) {
    super(code, message);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {}

export class ForbiddenError extends AppError {}

export class NotFoundError extends AppError {}

export class ConflictError extends AppError {}

export class TooManyRequestsError extends AppError {}
