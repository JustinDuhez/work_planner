import { hashToken } from './session-token';

export const MAX_FAILED_LOGINS = 5;
export const LOGIN_FAILURE_WINDOW_IN_MILLISECONDS = 15 * 60_000;
export const EXPIRED_WINDOW_SWEEP_THRESHOLD = 10_000;

interface AttemptWindow {
  count: number;
  startedAtInMilliseconds: number;
}

// ponytail: in-memory, valid for the single Render instance; move to Postgres or Redis
// if the API ever runs on several instances. Past EXPIRED_WINDOW_SWEEP_THRESHOLD tracked keys,
// expired windows are swept before inserting; the map can still grow when nothing has expired.
// Its real bound is login throughput (argon2-limited, plus 30 attempts/min per IP) x the
// 15-minute window, with fixed-size entries (keys are hashed).
export class LoginFailureLimiter {
  readonly #attempts = new Map<string, AttemptWindow>();
  readonly #now: () => Date;

  constructor(now: () => Date) {
    this.#now = now;
  }

  get trackedKeyCount(): number {
    return this.#attempts.size;
  }

  isLocked(key: string): boolean {
    return (this.#currentWindow(hashToken(key))?.count ?? 0) >= MAX_FAILED_LOGINS;
  }

  // Counts attempts, not failures: the login route records before verifying the password so
  // parallel requests cannot all pass the check while the slow hash verification runs.
  recordAttempt(key: string): void {
    const hashedKey = hashToken(key);
    const window = this.#currentWindow(hashedKey);
    if (window) {
      window.count += 1;
      return;
    }
    if (this.#attempts.size >= EXPIRED_WINDOW_SWEEP_THRESHOLD) {
      this.#forgetExpiredWindows();
    }
    this.#attempts.set(hashedKey, { count: 1, startedAtInMilliseconds: this.#now().getTime() });
  }

  clear(key: string): void {
    this.#attempts.delete(hashToken(key));
  }

  #isExpired(window: AttemptWindow): boolean {
    return (
      this.#now().getTime() - window.startedAtInMilliseconds >= LOGIN_FAILURE_WINDOW_IN_MILLISECONDS
    );
  }

  #currentWindow(hashedKey: string): AttemptWindow | undefined {
    const window = this.#attempts.get(hashedKey);
    if (window && this.#isExpired(window)) {
      this.#attempts.delete(hashedKey);
      return undefined;
    }
    return window;
  }

  #forgetExpiredWindows(): void {
    for (const [hashedKey, window] of this.#attempts) {
      if (this.#isExpired(window)) {
        this.#attempts.delete(hashedKey);
      }
    }
  }
}
