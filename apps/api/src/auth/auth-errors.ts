import {
  ForbiddenError,
  PASSWORD_POLICY_MESSAGES,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
  type PasswordPolicyViolation,
} from '@work-planner/domain';

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
}

export class AccountBlockedError extends ForbiddenError {
  constructor() {
    super('ACCOUNT_BLOCKED', 'Votre compte est bloqué. Contactez un administrateur.');
  }
}

export class UnauthenticatedError extends UnauthorizedError {
  constructor() {
    super('UNAUTHENTICATED', 'Votre session a expiré. Reconnectez-vous.');
  }
}

export class CsrfInvalidError extends ForbiddenError {
  constructor() {
    super('CSRF_INVALID', 'Requête refusée. Rechargez la page.');
  }
}

export class TooManyAttemptsError extends TooManyRequestsError {
  constructor() {
    super('TOO_MANY_ATTEMPTS', 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
}

export class PasswordPolicyError extends ValidationError {
  constructor(violation: PasswordPolicyViolation) {
    super(
      'PASSWORD_POLICY',
      "Le mot de passe doit contenir entre 12 et 128 caractères et être différent de l'actuel.",
      { newPassword: PASSWORD_POLICY_MESSAGES[violation] },
    );
  }
}

export class CurrentPasswordInvalidError extends ValidationError {
  constructor() {
    super('CURRENT_PASSWORD_INVALID', 'Le mot de passe actuel est incorrect.', {
      currentPassword: 'Le mot de passe actuel est incorrect.',
    });
  }
}

export class PasswordChangeRequiredError extends ForbiddenError {
  constructor() {
    super('PASSWORD_CHANGE_REQUIRED', 'Vous devez choisir un nouveau mot de passe.');
  }
}
