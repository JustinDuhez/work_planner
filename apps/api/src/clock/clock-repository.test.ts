import {
  ClockAlreadyRunningError,
  ClockPeriodOverlapError,
  ClockWriteConflictError,
} from './clock-errors';
import { translateClockConstraintError } from './clock-repository';

describe('translating clock constraint errors', () => {
  it('turns the one-open-period violation into "already running"', () => {
    expect(() =>
      translateClockConstraintError({ code: '23505', constraint: 'clock_period_one_open_per_day' }),
    ).toThrow(ClockAlreadyRunningError);
  });

  it('turns an exclusion violation into "period overlap"', () => {
    expect(() => translateClockConstraintError({ code: '23P01' })).toThrow(ClockPeriodOverlapError);
  });

  it.each(['40P01', '40001'])('turns the %s lock failure into "write conflict"', (code) => {
    expect(() => translateClockConstraintError({ code })).toThrow(ClockWriteConflictError);
  });

  it('rethrows other errors unchanged', () => {
    const error = Object.assign(new Error('other'), { code: '23505', constraint: 'other' });

    expect(() => translateClockConstraintError(error)).toThrow(error);
  });

  it('wraps a non-Error value, keeping it as the cause', () => {
    expect.assertions(2);
    try {
      translateClockConstraintError('boom');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).cause).toBe('boom');
    }
  });
});
