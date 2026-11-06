import { createTestClock } from '../test/test-clock';
import {
  LOGIN_FAILURE_WINDOW_IN_MILLISECONDS,
  LoginFailureLimiter,
  EXPIRED_WINDOW_SWEEP_THRESHOLD,
  MAX_FAILED_LOGINS,
} from './login-failure-limiter';

const KEY = '203.0.113.7|alice@example.com';

function attemptTimes(limiter: LoginFailureLimiter, count: number): void {
  for (let attempt = 0; attempt < count; attempt += 1) {
    limiter.recordAttempt(KEY);
  }
}

describe('LoginFailureLimiter', () => {
  it('lets someone retry after four attempts', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    attemptTimes(limiter, MAX_FAILED_LOGINS - 1);

    expect(limiter.isLocked(KEY)).toBe(false);
  });

  it('locks the email for this address after five attempts', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    attemptTimes(limiter, MAX_FAILED_LOGINS);

    expect(limiter.isLocked(KEY)).toBe(true);
  });

  it('does not lock the same email coming from another address', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    attemptTimes(limiter, MAX_FAILED_LOGINS);

    expect(limiter.isLocked('198.51.100.1|alice@example.com')).toBe(false);
  });

  it('unlocks once the fifteen-minute window is over', () => {
    const clock = createTestClock();
    const limiter = new LoginFailureLimiter(clock.now);
    attemptTimes(limiter, MAX_FAILED_LOGINS);

    clock.advanceBy(LOGIN_FAILURE_WINDOW_IN_MILLISECONDS);

    expect(limiter.isLocked(KEY)).toBe(false);
  });

  it('forgets earlier attempts after a successful login', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);
    attemptTimes(limiter, MAX_FAILED_LOGINS - 1);

    limiter.clear(KEY);
    attemptTimes(limiter, MAX_FAILED_LOGINS - 1);

    expect(limiter.isLocked(KEY)).toBe(false);
  });

  it('sweeps expired windows once many keys are tracked', () => {
    const clock = createTestClock();
    const limiter = new LoginFailureLimiter(clock.now);
    for (let keyNumber = 0; keyNumber < EXPIRED_WINDOW_SWEEP_THRESHOLD; keyNumber += 1) {
      limiter.recordAttempt(`key-${keyNumber}`);
    }
    clock.advanceBy(LOGIN_FAILURE_WINDOW_IN_MILLISECONDS);

    limiter.recordAttempt('fresh-key');

    expect(limiter.trackedKeyCount).toBe(1);
  });
});
