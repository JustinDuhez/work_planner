import type { HalfDaySlot } from './half-days';
import { findTeleworkShortfalls, teleworkRuleNote } from './telework-rule';

const NO_HOLIDAYS = new Set<string>();

function slots(date: string, halves: ('am' | 'pm')[] = ['am', 'pm']): HalfDaySlot[] {
  return halves.map((half) => ({ date, half }));
}

describe('findTeleworkShortfalls', () => {
  it('lets telework through when exactly 3 days stay on site', () => {
    // Week of Monday 16 November 2026: 10 workable half-days, 4 requested → 6 left.
    const requested = [...slots('2026-11-16'), ...slots('2026-11-17')];

    expect(findTeleworkShortfalls({ requested, declared: [], holidayDates: NO_HOLIDAYS })).toEqual(
      [],
    );
  });

  it('holds telework when only 2,5 days would stay on site', () => {
    const requested = [
      ...slots('2026-11-16'),
      ...slots('2026-11-17'),
      ...slots('2026-11-18', ['am']),
    ];

    expect(findTeleworkShortfalls({ requested, declared: [], holidayDates: NO_HOLIDAYS })).toEqual([
      { weekMonday: '2026-11-16', remainingOnSiteHalfDays: 5 },
    ]);
  });

  it('counts pending and approved declarations already in the week', () => {
    const declared = [...slots('2026-11-19'), ...slots('2026-11-20')];

    expect(
      findTeleworkShortfalls({
        requested: slots('2026-11-16'),
        declared,
        holidayDates: NO_HOLIDAYS,
      }),
    ).toEqual([{ weekMonday: '2026-11-16', remainingOnSiteHalfDays: 4 }]);
  });

  it('leaves less room in a week with a public holiday', () => {
    // Week of Monday 9 November 2026 with 11 November off: 8 workable half-days.
    expect(
      findTeleworkShortfalls({
        requested: slots('2026-11-09'),
        declared: [],
        holidayDates: new Set(['2026-11-11']),
      }),
    ).toEqual([]);
    expect(
      findTeleworkShortfalls({
        requested: [...slots('2026-11-09'), ...slots('2026-11-10', ['am'])],
        declared: [],
        holidayDates: new Set(['2026-11-11']),
      }),
    ).toEqual([{ weekMonday: '2026-11-09', remainingOnSiteHalfDays: 5 }]);
  });

  it('checks each week a request touches', () => {
    // Thursday 19 to Tuesday 24 November: 2 days in each week, both fine; a declared week 2 breaks it.
    const requested = [
      ...slots('2026-11-19'),
      ...slots('2026-11-20'),
      ...slots('2026-11-23'),
      ...slots('2026-11-24'),
    ];
    const declared = slots('2026-11-25');

    expect(findTeleworkShortfalls({ requested, declared, holidayDates: NO_HOLIDAYS })).toEqual([
      { weekMonday: '2026-11-23', remainingOnSiteHalfDays: 4 },
    ]);
  });
});

describe('teleworkRuleNote', () => {
  it('says nothing when every week is fine', () => {
    expect(teleworkRuleNote([])).toBeNull();
  });

  it('explains a shortfall with a French day count', () => {
    expect(teleworkRuleNote([{ weekMonday: '2026-11-16', remainingOnSiteHalfDays: 5 }])).toBe(
      'Il ne resterait que 2,5 jours sur site la semaine du 16 nov.',
    );
  });

  it('explains a week with no on-site time left', () => {
    expect(teleworkRuleNote([{ weekMonday: '2026-11-16', remainingOnSiteHalfDays: 0 }])).toBe(
      'Il ne resterait aucun jour sur site la semaine du 16 nov.',
    );
  });

  it('ends the sentence with a full stop after a month that is not abbreviated', () => {
    expect(teleworkRuleNote([{ weekMonday: '2026-05-04', remainingOnSiteHalfDays: 5 }])).toBe(
      'Il ne resterait que 2,5 jours sur site la semaine du 4 mai.',
    );
  });

  it('lists every short week', () => {
    expect(
      teleworkRuleNote([
        { weekMonday: '2026-11-16', remainingOnSiteHalfDays: 4 },
        { weekMonday: '2026-11-23', remainingOnSiteHalfDays: 1 },
      ]),
    ).toBe(
      'Il ne resterait que 2 jours sur site la semaine du 16 nov. Il ne resterait que 0,5 jour sur site la semaine du 23 nov.',
    );
  });
});
