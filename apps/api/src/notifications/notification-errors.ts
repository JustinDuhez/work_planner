import { NotFoundError } from '@work-planner/domain';

export class NotificationNotFoundError extends NotFoundError {
  constructor() {
    super('NOTIFICATION_NOT_FOUND', 'Notification introuvable.');
  }
}
