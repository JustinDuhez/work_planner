import { NotFoundError } from '@work-planner/domain';

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super('USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
}
