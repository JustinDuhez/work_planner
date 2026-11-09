import { ForbiddenError, ValidationError } from '@work-planner/domain';

export class CounterResetForbiddenError extends ForbiddenError {
  constructor() {
    super('COUNTER_RESET_FORBIDDEN', 'Vous ne pouvez pas remettre ce compteur à zéro.');
  }
}

export class CounterResetDateInFutureError extends ValidationError {
  constructor() {
    super(
      'COUNTER_RESET_DATE_IN_FUTURE',
      'La date de remise à zéro ne peut pas être dans le futur.',
    );
  }
}

export class CounterResetDateBeforeStartError extends ValidationError {
  constructor() {
    super(
      'COUNTER_RESET_DATE_BEFORE_START',
      "La date de remise à zéro ne peut pas précéder la date d'arrivée.",
    );
  }
}
