import { dayBounds } from './time-zone';
import { dayWorkedMinutes, findDayPeriodViolation, periodMinutes } from './worked-minutes';

const PARIS = 'Europe/Paris';
const DAY = '2026-11-06';
const BOUNDS = dayBounds(DAY, PARIS);
const NOW = new Date('2026-11-06T14:30:00Z'); // 15:30 in Paris

function at(isoInstant: string): Date {
  return new Date(isoInstant);
}

const morning = { startedAt: at('2026-11-06T08:00:00Z'), endedAt: at('2026-11-06T11:30:00Z') }; // 09:00-12:30
const afternoonRunning = { startedAt: at('2026-11-06T12:30:00Z'), endedAt: null }; // 13:30-

describe('periodMinutes', () => {
  it('counts whole minutes', () => {
    expect(periodMinutes(morning.startedAt, morning.endedAt)).toBe(210);
  });
});

describe('dayWorkedMinutes', () => {
  it('adds up closed periods', () => {
    expect(dayWorkedMinutes([morning], { now: NOW, isToday: true })).toBe(210);
  });

  it("counts today's running period up to now", () => {
    expect(dayWorkedMinutes([morning, afternoonRunning], { now: NOW, isToday: true })).toBe(330);
  });

  it('counts an open period of a past day as zero until its end is set', () => {
    expect(dayWorkedMinutes([morning, afternoonRunning], { now: NOW, isToday: false })).toBe(210);
  });

  it('gives an empty day zero minutes', () => {
    expect(dayWorkedMinutes([], { now: NOW, isToday: true })).toBe(0);
  });
});

describe('findDayPeriodViolation', () => {
  it('accepts valid periods, including back-to-back ones', () => {
    const backToBack = { startedAt: morning.endedAt, endedAt: at('2026-11-06T12:00:00Z') };

    expect(findDayPeriodViolation([morning, backToBack, afternoonRunning], BOUNDS, NOW)).toBeNull();
  });

  it('refuses an end before or at the start', () => {
    const reversed = { startedAt: morning.endedAt, endedAt: morning.startedAt };

    expect(findDayPeriodViolation([reversed], BOUNDS, NOW)).toBe('CLOCK_END_BEFORE_START');
  });

  it('refuses a start before the day begins', () => {
    const tooEarly = { startedAt: at('2026-11-05T22:59:00Z'), endedAt: morning.startedAt };

    expect(findDayPeriodViolation([tooEarly], BOUNDS, NOW)).toBe('CLOCK_TIME_OUTSIDE_DAY');
  });

  it('refuses an end at midnight: the day ends at 23:59', () => {
    const lateNow = at('2026-11-07T10:00:00Z');
    const untilMidnight = { startedAt: at('2026-11-06T22:00:00Z'), endedAt: BOUNDS.nextStart };

    expect(findDayPeriodViolation([untilMidnight], BOUNDS, lateNow)).toBe('CLOCK_TIME_OUTSIDE_DAY');
  });

  it('refuses a start or an end in the future', () => {
    const future = { startedAt: at('2026-11-06T15:00:00Z'), endedAt: null };
    const endsLater = { startedAt: morning.startedAt, endedAt: at('2026-11-06T14:31:00Z') };

    expect(findDayPeriodViolation([future], BOUNDS, NOW)).toBe('CLOCK_TIME_IN_FUTURE');
    expect(findDayPeriodViolation([endsLater], BOUNDS, NOW)).toBe('CLOCK_TIME_IN_FUTURE');
  });

  it('refuses two open periods on the same day', () => {
    const otherOpen = { startedAt: at('2026-11-06T13:00:00Z'), endedAt: null };

    expect(findDayPeriodViolation([afternoonRunning, otherOpen], BOUNDS, NOW)).toBe(
      'CLOCK_ALREADY_RUNNING',
    );
  });

  it('refuses overlapping periods', () => {
    const overlapping = {
      startedAt: at('2026-11-06T11:00:00Z'),
      endedAt: at('2026-11-06T12:00:00Z'),
    };

    expect(findDayPeriodViolation([overlapping, morning], BOUNDS, NOW)).toBe(
      'CLOCK_PERIOD_OVERLAP',
    );
  });

  it('refuses a closed period that starts after a running one', () => {
    const afterRunning = {
      startedAt: at('2026-11-06T13:00:00Z'),
      endedAt: at('2026-11-06T14:00:00Z'),
    };

    expect(findDayPeriodViolation([afternoonRunning, afterRunning], BOUNDS, NOW)).toBe(
      'CLOCK_PERIOD_OVERLAP',
    );
  });
});
