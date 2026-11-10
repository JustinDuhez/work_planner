export type UserAccessViolation = 'USER_SELF_RESTRICTION' | 'USER_LAST_ADMIN';

export interface AccessChange {
  isSelf: boolean;
  /** The change demotes, blocks or archives the target. */
  removesAccess: boolean;
  /** The target is an active, unblocked admin who would stop being one. */
  removesActiveAdmin: boolean;
  activeAdminCount: number;
}

/** E2a-D4: nobody locks themselves out, and the company always keeps an admin. */
export function findUserAccessViolation(change: AccessChange): UserAccessViolation | null {
  if (change.isSelf && change.removesAccess) return 'USER_SELF_RESTRICTION';
  if (change.removesActiveAdmin && change.activeAdminCount <= 1) return 'USER_LAST_ADMIN';
  return null;
}
