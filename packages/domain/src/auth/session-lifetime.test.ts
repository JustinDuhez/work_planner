import {
  computeSessionExpiry,
  isSessionActive,
  SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS,
  SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS,
  SESSION_IDLE_TIMEOUT_IN_MILLISECONDS,
  shouldRefreshActivity,
} from './session-lifetime';

const LOGIN_TIME = new Date('2026-11-06T08:00:00.000Z');
const ONE_MILLISECOND = 1;

function at(offsetInMilliseconds: number): Date {
  return new Date(LOGIN_TIME.getTime() + offsetInMilliseconds);
}

describe('session lifetime', () => {
  const session = { lastSeenAt: LOGIN_TIME, expiresAt: computeSessionExpiry(LOGIN_TIME) };

  it('expires seven days after login', () => {
    expect(session.expiresAt).toEqual(at(SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS));
  });

  it('stays active just before eight hours of inactivity', () => {
    expect(
      isSessionActive(session, at(SESSION_IDLE_TIMEOUT_IN_MILLISECONDS - ONE_MILLISECOND)),
    ).toBe(true);
  });

  it('ends after exactly eight hours of inactivity', () => {
    expect(isSessionActive(session, at(SESSION_IDLE_TIMEOUT_IN_MILLISECONDS))).toBe(false);
  });

  it('ends at the absolute limit even when the user was active a moment ago', () => {
    const recentlyActive = {
      lastSeenAt: at(SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS - ONE_MILLISECOND),
      expiresAt: session.expiresAt,
    };

    expect(isSessionActive(recentlyActive, at(SESSION_ABSOLUTE_LIFETIME_IN_MILLISECONDS))).toBe(
      false,
    );
  });

  it('does not refresh activity again within five minutes', () => {
    expect(
      shouldRefreshActivity(
        LOGIN_TIME,
        at(SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS - ONE_MILLISECOND),
      ),
    ).toBe(false);
  });

  it('refreshes activity once five minutes have passed', () => {
    expect(
      shouldRefreshActivity(LOGIN_TIME, at(SESSION_ACTIVITY_REFRESH_INTERVAL_IN_MILLISECONDS)),
    ).toBe(true);
  });
});
