import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type CorrectionPeriodProblem,
} from '@work-planner/domain';
import { ClockTimeInvalidError, clockViolationError } from '../clock/clock-errors';

export class ClockCorrectionForbiddenError extends ForbiddenError {
  constructor() {
    super('CLOCK_CORRECTION_FORBIDDEN', 'Vous ne pouvez pas corriger cette journée.');
  }
}

export class ClockCorrectionsViewForbiddenError extends ForbiddenError {
  constructor() {
    super(
      'CLOCK_CORRECTIONS_VIEW_FORBIDDEN',
      'Vous ne pouvez pas consulter les corrections de cette personne.',
    );
  }
}

export class ClockCorrectionDayNotPastError extends ValidationError {
  constructor() {
    super('CLOCK_CORRECTION_DAY_NOT_PAST', 'Seule une journée passée peut être corrigée.');
  }
}

export class ClockCorrectionNotFoundError extends NotFoundError {
  constructor() {
    super('CLOCK_CORRECTION_NOT_FOUND', 'Correction introuvable.');
  }
}

export class ClockCorrectionAnswerForbiddenError extends ForbiddenError {
  constructor() {
    super(
      'CLOCK_CORRECTION_ANSWER_FORBIDDEN',
      'Seule la personne concernée peut répondre à cette correction.',
    );
  }
}

export class ClockCorrectionNotPendingError extends ConflictError {
  constructor() {
    super(
      'CLOCK_CORRECTION_NOT_PENDING',
      'Cette correction a déjà reçu une réponse ou a été remplacée.',
    );
  }
}

/** Same code and message as E3, plus a field error on the faulty period of the dialog. */
export function correctionProblemError(problem: CorrectionPeriodProblem): ValidationError {
  const cause =
    problem.violation === 'CLOCK_TIME_INVALID'
      ? new ClockTimeInvalidError()
      : clockViolationError(problem.violation);
  return new ValidationError(cause.code, cause.message, {
    [`periods.${problem.periodIndex}.${problem.field}`]: cause.message,
  });
}
