import {
  clockWeekPath,
  currentIsoWeek,
  dayLabel,
  shiftIsoWeek,
  weekNumberLabel,
  weekRangeLabel,
} from './clock-time';

describe('clock time helpers', () => {
  it('finds the current week in Paris time', () => {
    expect(currentIsoWeek(new Date('2026-11-08T22:59:00Z'))).toBe('2026-W45');
    expect(currentIsoWeek(new Date('2026-11-08T23:00:00Z'))).toBe('2026-W46');
  });

  it('moves between weeks across a year boundary', () => {
    expect(shiftIsoWeek('2026-W53', 1)).toBe('2027-W01');
    expect(shiftIsoWeek('2027-W01', -1)).toBe('2026-W53');
  });

  it('labels a week like the mockup', () => {
    expect(weekNumberLabel('2026-W05')).toBe('S5');
    expect(weekRangeLabel('2026-W45')).toBe('2 – 8 nov. 2026');
  });

  it('labels a day with its short French weekday', () => {
    expect(dayLabel('2026-11-02')).toEqual({ weekday: 'LUN', dayOfMonth: '2' });
  });

  it('builds the URL of my week or of someone else’s week', () => {
    expect(clockWeekPath(undefined, '2026-W45')).toBe('/?semaine=2026-W45');
    expect(clockWeekPath(9, '2026-W45')).toBe('/pointage/9?semaine=2026-W45');
  });
});
