import { expandWorkableHalfDays, isRangeOrdered, mondayOf } from './half-days';

const NO_HOLIDAYS = new Set<string>();

describe('isRangeOrdered', () => {
  it.each([
    [{ startDate: '2026-11-23', startHalf: 'am', endDate: '2026-11-23', endHalf: 'am' }, true],
    [{ startDate: '2026-11-23', startHalf: 'am', endDate: '2026-11-23', endHalf: 'pm' }, true],
    [{ startDate: '2026-11-23', startHalf: 'pm', endDate: '2026-11-23', endHalf: 'am' }, false],
    [{ startDate: '2026-11-24', startHalf: 'am', endDate: '2026-11-23', endHalf: 'pm' }, false],
    [{ startDate: '2026-11-23', startHalf: 'pm', endDate: '2026-11-24', endHalf: 'am' }, true],
  ] as const)('orders %o as %s', (range, isOrdered) => {
    expect(isRangeOrdered(range)).toBe(isOrdered);
  });
});

describe('expandWorkableHalfDays', () => {
  it('gives one half-day', () => {
    expect(
      expandWorkableHalfDays(
        { startDate: '2026-11-23', startHalf: 'pm', endDate: '2026-11-23', endHalf: 'pm' },
        NO_HOLIDAYS,
      ),
    ).toEqual([{ date: '2026-11-23', half: 'pm' }]);
  });

  it('starts and ends on the requested halves', () => {
    const slots = expandWorkableHalfDays(
      { startDate: '2026-11-23', startHalf: 'pm', endDate: '2026-11-24', endHalf: 'am' },
      NO_HOLIDAYS,
    );

    expect(slots).toEqual([
      { date: '2026-11-23', half: 'pm' },
      { date: '2026-11-24', half: 'am' },
    ]);
  });

  it('skips weekends and public holidays', () => {
    // Friday 6 to Wednesday 11 November 2026; 11 November is a holiday.
    const slots = expandWorkableHalfDays(
      { startDate: '2026-11-06', startHalf: 'am', endDate: '2026-11-11', endHalf: 'pm' },
      new Set(['2026-11-11']),
    );

    expect(slots.map((slot) => slot.date)).toEqual([
      '2026-11-06',
      '2026-11-06',
      '2026-11-09',
      '2026-11-09',
      '2026-11-10',
      '2026-11-10',
    ]);
  });

  it('gives nothing for a weekend only', () => {
    expect(
      expandWorkableHalfDays(
        { startDate: '2026-11-07', startHalf: 'am', endDate: '2026-11-08', endHalf: 'pm' },
        NO_HOLIDAYS,
      ),
    ).toEqual([]);
  });
});

describe('mondayOf', () => {
  it.each([
    ['2026-11-16', '2026-11-16'],
    ['2026-11-22', '2026-11-16'],
    ['2027-01-01', '2026-12-28'],
  ])('puts %s in the week of %s', (date, monday) => {
    expect(mondayOf(date)).toBe(monday);
  });
});
