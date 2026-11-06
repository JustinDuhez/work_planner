const DEFAULT_START = new Date('2026-11-06T08:00:00.000Z');

export interface TestClock {
  now: () => Date;
  advanceBy: (milliseconds: number) => void;
}

export function createTestClock(start: Date = DEFAULT_START): TestClock {
  let currentTimeInMilliseconds = start.getTime();
  return {
    now: () => new Date(currentTimeInMilliseconds),
    advanceBy: (milliseconds) => {
      currentTimeInMilliseconds += milliseconds;
    },
  };
}
