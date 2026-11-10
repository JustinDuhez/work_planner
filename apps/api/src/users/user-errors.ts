import { ConflictError, ForbiddenError, NotFoundError } from '@work-planner/domain';

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

export class UserEmailTakenError extends ConflictError {
  constructor() {
    super('USER_EMAIL_TAKEN', 'Cette adresse e-mail est déjà utilisée.');
  }
}

export class UserSelfRestrictionError extends ForbiddenError {
  constructor() {
    super(
      'USER_SELF_RESTRICTION',
      'Vous ne pouvez pas retirer vos propres droits ni bloquer ou archiver votre compte.',
    );
  }
}

export class UserLastAdminError extends ConflictError {
  constructor() {
    super('USER_LAST_ADMIN', 'Il doit rester au moins un administrateur actif.');
  }
}

export class UserManagesTeamError extends ConflictError {
  constructor(teamName: string) {
    super(
      'USER_MANAGES_TEAM',
      `Cette personne gère l'équipe « ${teamName} ». Désignez d'abord un autre responsable.`,
    );
  }
}
