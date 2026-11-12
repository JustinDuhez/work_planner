import {
  ConflictError,
  ForbiddenError,
  formatDayMonth,
  NotFoundError,
  ValidationError,
  type HalfDaySlot,
} from '@work-planner/domain';

const HALF_LABEL = { am: 'matin', pm: 'après-midi' } as const;

export class LeaveTypeNotRequestableError extends ValidationError {
  constructor() {
    const message = 'Ce type ne peut pas être demandé.';
    super('LEAVE_TYPE_NOT_REQUESTABLE', message, { dayTypeCode: message });
  }
}

export class LeaveDateInPastError extends ValidationError {
  constructor() {
    const message = "La demande doit commencer aujourd'hui ou plus tard.";
    super('LEAVE_DATE_IN_PAST', message, { startDate: message });
  }
}

export class LeaveRangeOrderError extends ValidationError {
  constructor() {
    const message = 'La fin doit être après le début.';
    super('LEAVE_RANGE_ORDER', message, { endDate: message });
  }
}

export class LeaveRangeTooLongError extends ValidationError {
  constructor() {
    const message = 'Une demande ne peut pas dépasser un an.';
    super('LEAVE_RANGE_TOO_LONG', message, { endDate: message });
  }
}

export class LeaveEmptyRangeError extends ValidationError {
  constructor() {
    super('LEAVE_EMPTY_RANGE', 'Aucune demi-journée travaillée dans cette période.');
  }
}

export class LeaveReasonRequiredError extends ValidationError {
  constructor() {
    const message = 'Indiquez le motif du départ anticipé.';
    super('LEAVE_REASON_REQUIRED', message, { reason: message });
  }
}

export class LeaveSingleHalfDayError extends ValidationError {
  constructor() {
    super('LEAVE_SINGLE_HALF_DAY', 'Un départ anticipé porte sur une seule demi-journée.');
  }
}

export class LeaveCommentRequiredError extends ValidationError {
  constructor() {
    const message = 'Indiquez la raison du refus.';
    super('LEAVE_COMMENT_REQUIRED', message, { comment: message });
  }
}

export class LeaveOverlapError extends ConflictError {
  constructor(slot: HalfDaySlot) {
    super(
      'LEAVE_OVERLAP',
      `Le ${formatDayMonth(slot.date)} (${HALF_LABEL[slot.half]}) est déjà déclaré.`,
    );
  }
}

export class LeaveNotFoundError extends NotFoundError {
  constructor() {
    super('LEAVE_NOT_FOUND', 'Demande introuvable.');
  }
}

export class LeaveReviewForbiddenError extends ForbiddenError {
  constructor() {
    super('LEAVE_REVIEW_FORBIDDEN', 'Vous ne pouvez pas valider cette demande.');
  }
}

export class LeaveNotPendingError extends ConflictError {
  constructor() {
    super('LEAVE_NOT_PENDING', 'Cette demande a déjà été traitée.');
  }
}

export class LeaveNotCancellableError extends ConflictError {
  constructor() {
    super('LEAVE_NOT_CANCELLABLE', 'Cette demande ne peut plus être annulée.');
  }
}
