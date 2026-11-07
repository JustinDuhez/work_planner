import { datesOfIsoWeek, isoWeekOf } from './iso-week';

describe('isoWeekOf', () => {
  it.each([
    ['a Saturday', '2026-11-07', '2026-W45'],
    ['a Monday', '2026-11-02', '2026-W45'],
    ['the last day of a 53-week year', '2026-12-31', '2026-W53'],
    ['a January day that belongs to the previous ISO year', '2027-01-01', '2026-W53'],
    ['the first Monday of the ISO year', '2027-01-04', '2027-W01'],
    ['a late December day of the next ISO year', '2025-12-29', '2026-W01'],
  ])('puts %s in the right week', (_description, workDate, expected) => {
    expect(isoWeekOf(workDate)).toBe(expected);
  });
});

describe('datesOfIsoWeek', () => {
  it('lists the seven days from Monday to Sunday', () => {
    expect(datesOfIsoWeek('2026-W45')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('accepts week 53 of a 53-week year', () => {
    expect(datesOfIsoWeek('2026-W53')?.[0]).toBe('2026-12-28');
  });

  it.each([
    ['week 53 of a 52-week year', '2025-W53'],
    ['week 0', '2026-W00'],
    ['a malformed week', '2026-45'],
    ['a week whose Monday leaves the 4-digit years', '9999-W53'],
  ])('refuses %s', (_description, isoWeek) => {
    expect(datesOfIsoWeek(isoWeek)).toBeNull();
  });
});
