import { monthsOfPeriod, periodStartYearContaining, yearPeriodOf } from './year-period';

describe('yearPeriodOf', () => {
  it.each([
    [2026, '07-01', { startDate: '2026-07-01', endDate: '2027-06-30' }],
    [2026, '01-01', { startDate: '2026-01-01', endDate: '2026-12-31' }],
    [2026, '09-15', { startDate: '2026-09-15', endDate: '2027-09-14' }],
    // The day before 1 March in a leap year is 29 February.
    [2027, '03-01', { startDate: '2027-03-01', endDate: '2028-02-29' }],
  ])('gives the period starting in %i with %s', (startYear, yearStart, period) => {
    expect(yearPeriodOf(startYear, yearStart)).toEqual(period);
  });
});

describe('periodStartYearContaining', () => {
  it.each([
    ['2026-11-13', '07-01', 2026],
    ['2026-06-30', '07-01', 2025],
    ['2026-07-01', '07-01', 2026],
    ['2026-11-13', '01-01', 2026],
    ['2026-09-14', '09-15', 2025],
  ])('puts %s with %s in the period of %i', (date, yearStart, startYear) => {
    expect(periodStartYearContaining(date, yearStart)).toBe(startYear);
  });
});

describe('monthsOfPeriod', () => {
  it('gives 12 months from July to June', () => {
    const months = monthsOfPeriod(yearPeriodOf(2026, '07-01'));

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 7 });
    expect(months[11]).toEqual({ year: 2027, month: 6 });
  });

  it('gives 13 months when the period starts mid-month', () => {
    const months = monthsOfPeriod(yearPeriodOf(2026, '09-15'));

    expect(months).toHaveLength(13);
    expect(months[12]).toEqual({ year: 2027, month: 9 });
  });
});
