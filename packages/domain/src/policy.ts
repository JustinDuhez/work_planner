export interface Actor {
  readonly id: number;
  readonly isAdmin: boolean;
  readonly isManager: boolean;
  /** Members and sub-team managers of every team the actor manages, recursively. */
  readonly managedUserIds: ReadonlySet<number>;
  /** Members of the actor's teams and managers of their direct child teams. */
  readonly directReportIds: ReadonlySet<number>;
}

function isSelf(actor: Actor, targetId: number): boolean {
  return actor.id === targetId;
}

function canActOnWorkingTimeOf(actor: Actor, targetId: number): boolean {
  if (actor.isAdmin) return true;
  if (isSelf(actor, targetId)) return actor.isManager;
  return actor.managedUserIds.has(targetId);
}

export function canEditPastClock(actor: Actor, targetId: number): boolean {
  return canActOnWorkingTimeOf(actor, targetId);
}

export function canResetCounter(actor: Actor, targetId: number): boolean {
  return canActOnWorkingTimeOf(actor, targetId);
}

export function canEditDailyMinutes(actor: Actor, targetId: number): boolean {
  return canActOnWorkingTimeOf(actor, targetId);
}

export function requiresCorrectionConsent(actor: Actor, targetId: number): boolean {
  return !isSelf(actor, targetId);
}

/** Approving one's own leave would be a conflict of interest (decision E1-D6). */
export function canReviewLeave(actor: Actor, requesterId: number): boolean {
  if (isSelf(actor, requesterId)) return false;
  return actor.isAdmin || actor.directReportIds.has(requesterId);
}

export function canEditProfile(actor: Actor, targetId: number): boolean {
  return isSelf(actor, targetId);
}

export function canManageUsers(actor: Actor): boolean {
  return actor.isAdmin;
}

export function canManageTeams(actor: Actor): boolean {
  return actor.isAdmin;
}

export function canManageHolidays(actor: Actor): boolean {
  return actor.isAdmin;
}

export function canManageSettings(actor: Actor): boolean {
  return actor.isAdmin;
}
