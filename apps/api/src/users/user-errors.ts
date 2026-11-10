import { ForbiddenError, NotFoundError } from '@work-planner/domain';

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super('USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
}

export class UserManagementForbiddenError extends ForbiddenError {
  constructor() {
    super('USER_MANAGEMENT_FORBIDDEN', 'Vous ne pouvez pas gérer les utilisateurs.');
  }
}
