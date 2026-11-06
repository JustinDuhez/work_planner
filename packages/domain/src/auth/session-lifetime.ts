const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export const SESSION_IDLE_TIMEOUT_IN_MILLISECONDS = 8 * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
export const SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS =
  7 * HOURS_PER_DAY * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
// Refreshing last_seen_at on every request would cost a write per call for no real gain.
export const SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS = 5 * MILLISECONDS_PER_MINUTE;

export interface SessionTimestamps {
  lastSeenAt: Date;
  expiresAt: Date;
}

export function computeSessionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS);
}

export function isSessionActive({ lastSeenAt, expiresAt }: SessionTimestamps, now: Date): boolean {
  const isBeforeAbsoluteLimit = now.getTime() < expiresAt.getTime();
  const isWithinIdleTimeout =
    now.getTime() - lastSeenAt.getTime() < SESSION_IDLE_TIMEOUT_IN_MILLISECONDS;
  return isBeforeAbsoluteLimit && isWithinIdleTimeout;
}

export function shouldRefreshActivity(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS;
}
