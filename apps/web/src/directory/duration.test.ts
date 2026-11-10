import { parseDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['6:30', 390],
    ['7', 420],
    ['0:01', 1],
    ['24:00', 1440],
    [' 7:00 ', 420],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', 'abc', '7:60', '25:00', '0:00', '-1:00'])('refuses %s', (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});
