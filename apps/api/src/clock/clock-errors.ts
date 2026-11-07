import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AppError,
  type ClockViolation,
} from '@work-planner/domain';

export class ClockAlreadyRunningError extends ConflictError {
  constructor() {
    super('CLOCK_ALREADY_RUNNING', 'Une période est déjà en cours.');
  }
}

export class ClockPeriodOverlapError extends ConflictError {
  constructor() {
    super('CLOCK_PERIOD_OVERLAP', 'Cette période chevauche une autre période.');
  }
}

export class ClockTimeInFutureError extends ValidationError {
  constructor() {
    super('CLOCK_TIME_IN_FUTURE', "L'heure ne peut pas être dans le futur.");
  }
}

export class ClockTimeOutsideDayError extends ValidationError {
  constructor() {
    super('CLOCK_TIME_OUTSIDE_DAY', "L'heure doit être comprise dans la journée.");
  }
}

export class ClockEndBeforeStartError extends ValidationError {
  constructor() {
    super('CLOCK_END_BEFORE_START', "L'heure de fin doit être après l'heure de début.");
  }
}

export class ClockTimeInvalidError extends ValidationError {
  constructor() {
    super('CLOCK_TIME_INVALID', "Cette heure n'existe pas ce jour-là (changement d'heure).");
  }
}

export class ClockDayNotEditableError extends ForbiddenError {
  constructor() {
    super('CLOCK_DAY_NOT_EDITABLE', 'Cette journée ne peut plus être modifiée.');
  }
}

export class ClockPeriodNotFoundError extends NotFoundError {
  constructor() {
    super('CLOCK_PERIOD_NOT_FOUND', 'Période introuvable.');
  }
}

const ERROR_BY_VIOLATION: Record<ClockViolation, () => AppError> = {
  CLOCK_END_BEFORE_START: () => new ClockEndBeforeStartError(),
  CLOCK_TIME_OUTSIDE_DAY: () => new ClockTimeOutsideDayError(),
  CLOCK_TIME_IN_FUTURE: () => new ClockTimeInFutureError(),
  CLOCK_ALREADY_RUNNING: () => new ClockAlreadyRunningError(),
  CLOCK_PERIOD_OVERLAP: () => new ClockPeriodOverlapError(),
};

export function clockViolationError(violation: ClockViolation): AppError {
  return ERROR_BY_VIOLATION[violation]();
}
