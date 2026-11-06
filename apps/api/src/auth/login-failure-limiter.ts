export const MAX_FAILED_LOGINS = 5;
export const LOGIN_FAILURE_WINDOW_IN_MILLISECONDS = 15 * 60_000;
const MAX_TRACKED_KEYS = 10_000;

interface FailureWindow {
  count: number;
  startedAtInMilliseconds: number;
}

// ponytail: in-memory, valid for the single Render instance; move to Postgres or Redis
// if the API ever runs on several instances.
export class LoginFailureLimiter {
  readonly #failures = new Map<string, FailureWindow>();
  readonly #now: () => Date;

  constructor(now: () => Date) {
    this.#now = now;
  }

  isLocked(key: string): boolean {
    return (this.#currentWindow(key)?.count ?? 0) >= MAX_FAILED_LOGINS;
  }

  recordFailure(key: string): void {
    const window = this.#currentWindow(key);
    if (window) {
      window.count += 1;
      return;
    }
    if (this.#failures.size >= MAX_TRACKED_KEYS) {
      this.#forgetExpiredWindows();
    }
    this.#failures.set(key, { count: 1, startedAtInMilliseconds: this.#now().getTime() });
  }

  clear(key: string): void {
    this.#failures.delete(key);
  }

  #isExpired(window: FailureWindow): boolean {
    return (
      this.#now().getTime() - window.startedAtInMilliseconds >= LOGIN_FAILURE_WINDOW_IN_MILLISECONDS
    );
  }

  #currentWindow(key: string): FailureWindow | undefined {
    const window = this.#failures.get(key);
    if (window && this.#isExpired(window)) {
      this.#failures.delete(key);
      return undefined;
    }
    return window;
  }

  #forgetExpiredWindows(): void {
    for (const [key, window] of this.#failures) {
      if (this.#isExpired(window)) {
        this.#failures.delete(key);
      }
    }
  }
}
