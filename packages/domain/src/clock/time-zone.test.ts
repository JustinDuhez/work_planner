import {
  addDays,
  dayBounds,
  localTimeToInstant,
  toLocalTime,
  toWorkDate,
  truncateToMinute,
} from './time-zone';

const PARIS = 'Europe/Paris';
const MILLISECONDS_PER_HOUR = 3_600_000;

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MILLISECONDS_PER_HOUR;
}

describe('truncateToMinute', () => {
  it('drops seconds and milliseconds', () => {
    expect(truncateToMinute(new Date('2026-11-06T08:59:59.999Z'))).toEqual(
      new Date('2026-11-06T08:59:00.000Z'),
    );
  });
});

describe('toWorkDate', () => {
  it.each([
    ['winter, one minute before Paris midnight', '2026-11-06T22:59:00Z', '2026-11-06'],
    ['winter, at Paris midnight', '2026-11-06T23:00:00Z', '2026-11-07'],
    ['summer, one minute before Paris midnight', '2026-07-01T21:59:00Z', '2026-07-01'],
    ['summer, at Paris midnight', '2026-07-01T22:00:00Z', '2026-07-02'],
  ])('gives the Paris day %s', (_description, instant, expected) => {
    expect(toWorkDate(new Date(instant), PARIS)).toBe(expected);
  });
});

describe('toLocalTime', () => {
  it('shows the Paris wall-clock time', () => {
    expect(toLocalTime(new Date('2026-11-06T08:00:00Z'), PARIS)).toBe('09:00');
  });

  it('shows midnight as 00:00, never 24:00', () => {
    expect(toLocalTime(new Date('2026-11-06T23:00:00Z'), PARIS)).toBe('00:00');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('localTimeToInstant', () => {
  it('converts a winter wall-clock time', () => {
    expect(localTimeToInstant('2026-11-06', '09:00', PARIS)).toEqual(
      new Date('2026-11-06T08:00:00Z'),
    );
  });

  it('converts a summer wall-clock time', () => {
    expect(localTimeToInstant('2026-07-01', '09:00', PARIS)).toEqual(
      new Date('2026-07-01T07:00:00Z'),
    );
  });

  it('refuses a time skipped by the spring clock change', () => {
    expect(localTimeToInstant('2026-03-29', '02:30', PARIS)).toBeNull();
  });

  it('takes the first occurrence of a time repeated by the autumn clock change', () => {
    expect(localTimeToInstant('2026-10-25', '02:30', PARIS)).toEqual(
      new Date('2026-10-25T00:30:00Z'),
    );
  });

  it.each([
    ['a malformed time', '2026-11-06', '9:00'],
    ['an hour out of range', '2026-11-06', '24:00'],
    ['a date that does not exist', '2026-02-30', '09:00'],
    ['a malformed date', '06/11/2026', '09:00'],
  ])('refuses %s', (_description, workDate, localTime) => {
    expect(localTimeToInstant(workDate, localTime, PARIS)).toBeNull();
  });
});

describe('dayBounds', () => {
  it('gives an ordinary day 24 hours', () => {
    const bounds = dayBounds('2026-11-06', PARIS);

    expect(bounds.start).toEqual(new Date('2026-11-05T23:00:00Z'));
    expect(hoursBetween(bounds.start, bounds.nextStart)).toBe(24);
  });

  it('gives the spring clock-change day 23 hours', () => {
    const bounds = dayBounds('2026-03-29', PARIS);

    expect(bounds.start).toEqual(new Date('2026-03-28T23:00:00Z'));
    expect(hoursBetween(bounds.start, bounds.nextStart)).toBe(23);
  });

  it('gives the autumn clock-change day 25 hours', () => {
    const bounds = dayBounds('2026-10-25', PARIS);

    expect(bounds.start).toEqual(new Date('2026-10-24T22:00:00Z'));
    expect(hoursBetween(bounds.start, bounds.nextStart)).toBe(25);
  });

  it('refuses a malformed date', () => {
    expect(() => dayBounds('not-a-date', PARIS)).toThrow(RangeError);
  });
});
