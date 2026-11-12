import { formatDayCount, formatDayMonth } from './french-format';

describe('French leave formats', () => {
  it('writes a day and short month', () => {
    expect(formatDayMonth('2026-11-16')).toBe('16 nov.');
  });

  it.each([
    [1, '0,5 jour'],
    [2, '1 jour'],
    [3, '1,5 jour'],
    [4, '2 jours'],
    [7, '3,5 jours'],
  ])('writes %i half-days as %s', (halfDayCount, text) => {
    expect(formatDayCount(halfDayCount)).toBe(text);
  });
});
