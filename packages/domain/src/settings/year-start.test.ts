import { isValidYearStart, yearStartSchema } from './year-start';

describe('isValidYearStart', () => {
  it.each(['07-01', '01-01', '12-31', '02-28'])('accepts %s', (value) => {
    expect(isValidYearStart(value)).toBe(true);
  });

  it.each(['02-29', '13-01', '00-10', '04-31', '7-1', 'juillet'])('refuses %s', (value) => {
    expect(isValidYearStart(value)).toBe(false);
  });

  it('gives a French message', () => {
    expect(yearStartSchema.safeParse('02-29').error?.issues[0]?.message).toBe(
      'Choisissez un jour qui existe chaque année.',
    );
  });
});
