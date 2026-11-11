import { easterSunday, frenchPublicHolidays } from './french-holidays';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('puts Easter %i on %s', (year, date) => {
    expect(easterSunday(year)).toBe(date);
  });
});

describe('frenchPublicHolidays', () => {
  it('lists the 11 French public holidays of 2026 in date order', () => {
    expect(frenchPublicHolidays(2026)).toEqual([
      { date: '2026-01-01', label: "Jour de l'an" },
      { date: '2026-04-06', label: 'Lundi de Pâques' },
      { date: '2026-05-01', label: 'Fête du Travail' },
      { date: '2026-05-08', label: 'Victoire 1945' },
      { date: '2026-05-14', label: 'Ascension' },
      { date: '2026-05-25', label: 'Lundi de Pentecôte' },
      { date: '2026-07-14', label: 'Fête nationale' },
      { date: '2026-08-15', label: 'Assomption' },
      { date: '2026-11-01', label: 'Toussaint' },
      { date: '2026-11-11', label: 'Armistice 1918' },
      { date: '2026-12-25', label: 'Noël' },
    ]);
  });

  it('keeps one holiday per date when Ascension falls on 1 May (2008)', () => {
    const holidays = frenchPublicHolidays(2008);

    expect(holidays).toHaveLength(10);
    expect(holidays.find((holiday) => holiday.date === '2008-05-01')?.label).toBe(
      'Fête du Travail',
    );
  });
});
