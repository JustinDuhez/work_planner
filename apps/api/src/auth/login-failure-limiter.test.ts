import { createTestClock } from '../test/test-clock';
import {
  LOGIN_FAILURE_WINDOW_IN_MILLISECONDS,
  LoginFailureLimiter,
  MAX_FAILED_LOGINS,
} from './login-failure-limiter';

const KEY = '203.0.113.7|alice@example.com';

function failTimes(limiter: LoginFailureLimiter, count: number): void {
  for (let attempt = 0; attempt < count; attempt += 1) {
    limiter.recordFailure(KEY);
  }
}

describe('LoginFailureLimiter', () => {
  it('lets someone retry after four failures', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    failTimes(limiter, MAX_FAILED_LOGINS - 1);

    expect(limiter.isLocked(KEY)).toBe(false);
  });

  it('locks the email for this address after five failures', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    failTimes(limiter, MAX_FAILED_LOGINS);

    expect(limiter.isLocked(KEY)).toBe(true);
  });

  it('does not lock the same email coming from another address', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);

    failTimes(limiter, MAX_FAILED_LOGINS);

    expect(limiter.isLocked('198.51.100.1|alice@example.com')).toBe(false);
  });

  it('unlocks once the fifteen-minute window is over', () => {
    const clock = createTestClock();
    const limiter = new LoginFailureLimiter(clock.now);
    failTimes(limiter, MAX_FAILED_LOGINS);

    clock.advanceBy(LOGIN_FAILURE_WINDOW_IN_MILLISECONDS);

    expect(limiter.isLocked(KEY)).toBe(false);
  });

  it('forgets earlier failures after a successful login', () => {
    const limiter = new LoginFailureLimiter(createTestClock().now);
    failTimes(limiter, MAX_FAILED_LOGINS - 1);

    limiter.clear(KEY);
    failTimes(limiter, MAX_FAILED_LOGINS - 1);

    expect(limiter.isLocked(KEY)).toBe(false);
  });
});
