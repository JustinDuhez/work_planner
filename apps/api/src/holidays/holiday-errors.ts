import { ConflictError, ForbiddenError, NotFoundError } from '@work-planner/domain';

export class HolidayManagementForbiddenError extends ForbiddenError {
  constructor() {
    super('HOLIDAY_MANAGEMENT_FORBIDDEN', 'Vous ne pouvez pas gérer les jours fériés.');
  }
}

export class HolidayExistsError extends ConflictError {
  constructor() {
    super('HOLIDAY_EXISTS', 'Ce jour est déjà férié.');
  }
}

export class HolidayNotFoundError extends NotFoundError {
  constructor() {
    super('HOLIDAY_NOT_FOUND', 'Jour férié introuvable.');
  }
}
