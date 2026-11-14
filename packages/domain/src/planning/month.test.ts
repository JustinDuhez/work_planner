import { monthBounds, monthWeeks } from './month';

describe('monthBounds', () => {
  it.each([
    ['2026-11', { startDate: '2026-11-01', endDate: '2026-11-30' }],
    ['2026-12', { startDate: '2026-12-01', endDate: '2026-12-31' }],
    ['2028-02', { startDate: '2028-02-01', endDate: '2028-02-29' }],
  ])('gives the first and last day of %s', (yearMonth, bounds) => {
    expect(monthBounds(yearMonth)).toEqual(bounds);
  });
});

describe('monthWeeks', () => {
  it('splits November 2026 into its ISO weeks, partial weeks included', () => {
    const weeks = monthWeeks(monthBounds('2026-11'));

    expect(weeks.map((week) => week.weekNumber)).toEqual([44, 45, 46, 47, 48, 49]);
    expect(weeks[0]?.dates).toEqual(['2026-11-01']);
    expect(weeks[1]?.dates).toHaveLength(7);
    expect(weeks[5]?.dates).toEqual(['2026-11-30']);
  });
});
