import { formatMinutes, formatSignedMinutes } from './format-minutes';

describe('formatMinutes', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [420, '7:00'],
    [1231, '20:31'],
    [-29, '-0:29'],
    [-157, '-2:37'],
  ])('shows %i minutes as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe('formatSignedMinutes', () => {
  it.each([
    [90, '+1:30'],
    [1231, '+20:31'],
    [-29, '−0:29'],
    [0, '0:00'],
  ])('shows %i minutes as %s', (minutes, expected) => {
    expect(formatSignedMinutes(minutes)).toBe(expected);
  });
});
