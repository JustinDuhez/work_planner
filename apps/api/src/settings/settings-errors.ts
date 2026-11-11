import { ForbiddenError } from '@work-planner/domain';

export class SettingsForbiddenError extends ForbiddenError {
  constructor() {
    super('SETTINGS_FORBIDDEN', 'Vous ne pouvez pas modifier les paramètres.');
  }
}
