import {
  badgeableMinutesOf,
  counterDays,
  counterTotals,
  countingStartDate,
  dailyMinutesOn,
  type CountingRules,
} from './counting';

const at = (isoInstant: string) => new Date(isoInstant);

// Friday 6 November 2026, 15:30 in Paris (UTC+1).
const RULES: CountingRules = {
  countingStart: '2026-11-04',
  today: '2026-11-06',
  now: at('2026-11-06T14:30:00Z'),
  currentDailyMinutes: 420,
  dailyMinutesChanges: [],
  publicHolidayDates: new Set(),
};
const WEEK_45 = { fromDate: '2026-11-02', toDate: '2026-11-08' };

describe('countingStartDate', () => {
  it('starts at the reset when it is after the start date', () => {
    expect(countingStartDate('2026-10-12', '2026-11-02')).toBe('2026-11-02');
  });

  it('starts at the start date when the reset is earlier', () => {
    expect(countingStartDate('2026-11-02', '2026-10-12')).toBe('2026-11-02');
  });

  it('starts at the start date when there is no reset', () => {
    expect(countingStartDate('2026-11-02', null)).toBe('2026-11-02');
  });
});

describe('dailyMinutesOn', () => {
  const changes = [
    { effectiveDate: '2026-11-16', previousDailyMinutes: 360 },
    { effectiveDate: '2026-11-09', previousDailyMinutes: 420 },
  ];

  it.each([
    ['before every change', '2026-11-06', 420],
    ['on the day of the first change', '2026-11-09', 360],
    ['between two changes', '2026-11-13', 360],
    ['from the last change on', '2026-11-16', 300],
  ])('uses the daily time in force %s', (_description, date, expected) => {
    expect(dailyMinutesOn(date, 300, changes)).toBe(expected);
  });

  it('uses the current daily time when it never changed', () => {
    expect(dailyMinutesOn('2026-11-06', 420, [])).toBe(420);
  });
});

describe('badgeableMinutesOf', () => {
  it.each([
    ['a full weekday', '2026-11-06', 420, 2, 420],
    ['a weekday with one half-day off', '2026-11-06', 420, 1, 210],
    ['half of an odd daily time, rounded down', '2026-11-06', 425, 1, 212],
    ['a Saturday', '2026-11-07', 420, 2, 0],
    ['a Sunday', '2026-11-08', 420, 2, 0],
  ])('gives %s', (_description, date, dailyMinutes, halfDays, expected) => {
    expect(badgeableMinutesOf(date, dailyMinutes, halfDays)).toBe(expected);
  });
});

describe('counterDays', () => {
  const periodsByDate = new Map([
    [
      '2026-11-02',
      [{ startedAt: at('2026-11-02T08:00:00Z'), endedAt: at('2026-11-02T15:00:00Z') }],
    ],
    [
      '2026-11-04',
      [{ startedAt: at('2026-11-04T08:00:00Z'), endedAt: at('2026-11-04T15:00:00Z') }],
    ],
    [
      '2026-11-05',
      [{ startedAt: at('2026-11-05T08:00:00Z'), endedAt: at('2026-11-05T14:00:00Z') }],
    ],
    ['2026-11-06', [{ startedAt: at('2026-11-06T08:00:00Z'), endedAt: null }]],
  ]);

  it('counts nothing before the counting start', () => {
    const days = counterDays(WEEK_45, periodsByDate, RULES);

    expect(days.map((day) => day.date)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('counts past days fully and today without badgeable time', () => {
    const days = counterDays(WEEK_45, periodsByDate, RULES);

    expect(days.slice(0, 3)).toEqual([
      { date: '2026-11-04', targetMinutes: 420, badgeableMinutes: 420, workedMinutes: 420 },
      { date: '2026-11-05', targetMinutes: 420, badgeableMinutes: 420, workedMinutes: 360 },
      { date: '2026-11-06', targetMinutes: 420, badgeableMinutes: 0, workedMinutes: 390 },
    ]);
  });

  it('gives future weekend days no target and no worked time', () => {
    const days = counterDays(WEEK_45, periodsByDate, RULES);

    expect(days.slice(3)).toEqual([
      { date: '2026-11-07', targetMinutes: 0, badgeableMinutes: 0, workedMinutes: 0 },
      { date: '2026-11-08', targetMinutes: 0, badgeableMinutes: 0, workedMinutes: 0 },
    ]);
  });

  it('counts only the closed periods of a day left unclosed', () => {
    const unclosed = new Map([
      [
        '2026-11-05',
        [
          { startedAt: at('2026-11-05T08:00:00Z'), endedAt: at('2026-11-05T11:00:00Z') },
          { startedAt: at('2026-11-05T12:00:00Z'), endedAt: null },
        ],
      ],
    ]);

    const [thursday] = counterDays(
      { fromDate: '2026-11-05', toDate: '2026-11-05' },
      unclosed,
      RULES,
    );

    expect(thursday?.workedMinutes).toBe(180);
  });

  it('counts weekend work in real minutes, on the 25-hour clock-change Sunday too', () => {
    const sunday = new Map([
      [
        '2026-10-25',
        [{ startedAt: at('2026-10-24T23:00:00Z'), endedAt: at('2026-10-25T03:00:00Z') }],
      ],
    ]);
    const rules = { ...RULES, countingStart: '2026-10-01' };

    const [day] = counterDays({ fromDate: '2026-10-25', toDate: '2026-10-25' }, sunday, rules);

    expect(day).toEqual({
      date: '2026-10-25',
      targetMinutes: 0,
      badgeableMinutes: 0,
      workedMinutes: 240,
    });
  });

  it('uses the daily time in force on each day', () => {
    const rules = {
      ...RULES,
      dailyMinutesChanges: [{ effectiveDate: '2026-11-05', previousDailyMinutes: 480 }],
    };

    const days = counterDays({ fromDate: '2026-11-04', toDate: '2026-11-05' }, new Map(), rules);

    expect(days.map((day) => day.targetMinutes)).toEqual([480, 420]);
  });

  it('crosses a year boundary inside ISO week 53', () => {
    const rules = {
      ...RULES,
      countingStart: '2026-12-01',
      today: '2027-01-10',
      now: at('2027-01-10T10:00:00Z'),
    };

    const days = counterDays({ fromDate: '2026-12-28', toDate: '2027-01-03' }, new Map(), rules);

    expect(counterTotals(days).targetMinutes).toBe(5 * 420);
  });

  it('returns no day when the counting start is after the range', () => {
    expect(counterDays(WEEK_45, periodsByDate, { ...RULES, countingStart: '2026-11-09' })).toEqual(
      [],
    );
  });
});

describe('counterTotals', () => {
  it('adds worked, target and badgeable time and derives the gap', () => {
    const days = counterDays(WEEK_45, new Map(), RULES);
    const worked = [
      { ...days[0]!, workedMinutes: 420 },
      { ...days[1]!, workedMinutes: 360 },
      { ...days[2]!, workedMinutes: 390 },
    ];

    expect(counterTotals(worked)).toEqual({
      workedMinutes: 1170,
      targetMinutes: 1260,
      badgeableMinutes: 840,
      gapMinutes: 330,
    });
  });

  it('gives an empty list zero everywhere', () => {
    expect(counterTotals([])).toEqual({
      workedMinutes: 0,
      targetMinutes: 0,
      badgeableMinutes: 0,
      gapMinutes: 0,
    });
  });

  it('expects no time on a public holiday and still counts the time worked on it', () => {
    // Wednesday 11 November 2026 (Armistice), counted the next day.
    const rules = { ...RULES, today: '2026-11-12', publicHolidayDates: new Set(['2026-11-11']) };
    const periods = new Map([
      [
        '2026-11-11',
        [{ startedAt: at('2026-11-11T08:00:00Z'), endedAt: at('2026-11-11T10:00:00Z') }],
      ],
    ]);

    const [holiday] = counterDays({ fromDate: '2026-11-11', toDate: '2026-11-11' }, periods, rules);

    expect(holiday).toMatchObject({ targetMinutes: 0, badgeableMinutes: 0, workedMinutes: 120 });
  });
});
