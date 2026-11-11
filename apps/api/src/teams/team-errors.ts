import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@work-planner/domain';

export class TeamManagementForbiddenError extends ForbiddenError {
  constructor() {
    super('TEAM_MANAGEMENT_FORBIDDEN', 'Vous ne pouvez pas gérer les équipes.');
  }
}

export class TeamNotFoundError extends NotFoundError {
  constructor() {
    super('TEAM_NOT_FOUND', 'Équipe introuvable.');
  }
}

export class TeamNameTakenError extends ConflictError {
  constructor() {
    super('TEAM_NAME_TAKEN', 'Une équipe porte déjà ce nom.');
  }
}

export class TeamCycleError extends ConflictError {
  constructor() {
    super(
      'TEAM_CYCLE',
      'Une équipe ne peut pas être placée sous elle-même ou sous une de ses sous-équipes.',
    );
  }
}

export class TeamHasSubteamsError extends ConflictError {
  constructor() {
    super(
      'TEAM_HAS_SUBTEAMS',
      "Cette équipe contient des sous-équipes. Déplacez-les ou supprimez-les d'abord.",
    );
  }
}

const INVALID_PERSON_MESSAGE = "Une des personnes choisies n'existe pas ou est archivée.";

export class TeamInvalidPersonError extends ValidationError {
  constructor(field: 'managerId' | 'memberIds') {
    super('TEAM_INVALID_PERSON', INVALID_PERSON_MESSAGE, { [field]: INVALID_PERSON_MESSAGE });
  }
}
