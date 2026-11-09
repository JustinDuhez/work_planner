import { correctionPeriodsOf, hasOpenRefusal, latestCorrectionByDate } from './correction-rules';

const CONTEXT = { timeZone: 'Europe/Paris', now: new Date('2026-11-09T10:00:00Z') };
const DAY = '2026-11-03';

describe('correctionPeriodsOf', () => {
  it('turns local times into instants of that Paris day', () => {
    const result = correctionPeriodsOf(DAY, [{ startedAt: '09:00', endedAt: '12:30' }], CONTEXT);

    expect(result).toEqual({
      isValid: true,
      periods: [
        { startedAt: new Date('2026-11-03T08:00:00Z'), endedAt: new Date('2026-11-03T11:30:00Z') },
      ],
    });
  });

  it('accepts an empty day and back-to-back periods', () => {
    expect(correctionPeriodsOf(DAY, [], CONTEXT)).toEqual({ isValid: true, periods: [] });
    expect(
      correctionPeriodsOf(
        DAY,
        [
          { startedAt: '09:00', endedAt: '12:00' },
          { startedAt: '12:00', endedAt: '13:00' },
        ],
        CONTEXT,
      ).isValid,
    ).toBe(true);
  });

  it('points at the end of a period that ends before it starts', () => {
    const result = correctionPeriodsOf(
      DAY,
      [
        { startedAt: '09:00', endedAt: '12:00' },
        { startedAt: '14:00', endedAt: '13:00' },
      ],
      CONTEXT,
    );

    expect(result).toEqual({
      isValid: false,
      problem: { violation: 'CLOCK_END_BEFORE_START', periodIndex: 1, field: 'endedAt' },
    });
  });

  it('points at the start of the later period of an overlap, whatever the order sent', () => {
    const result = correctionPeriodsOf(
      DAY,
      [
        { startedAt: '11:00', endedAt: '13:00' },
        { startedAt: '09:00', endedAt: '12:00' },
      ],
      CONTEXT,
    );

    expect(result).toEqual({
      isValid: false,
      problem: { violation: 'CLOCK_PERIOD_OVERLAP', periodIndex: 0, field: 'startedAt' },
    });
  });

  it.each([
    ['a start', { startedAt: '02:30', endedAt: '04:00' }, 'startedAt'],
    ['an end', { startedAt: '01:00', endedAt: '02:30' }, 'endedAt'],
  ])('refuses %s skipped by the spring clock change', (_what, period, field) => {
    const result = correctionPeriodsOf('2026-03-29', [period], CONTEXT);

    expect(result).toEqual({
      isValid: false,
      problem: { violation: 'CLOCK_TIME_INVALID', periodIndex: 0, field },
    });
  });

  it('refuses a period that ends after now', () => {
    const today = { ...CONTEXT, now: new Date('2026-11-03T10:00:00Z') };

    const result = correctionPeriodsOf(DAY, [{ startedAt: '09:00', endedAt: '12:00' }], today);

    expect(result).toEqual({
      isValid: false,
      problem: { violation: 'CLOCK_TIME_IN_FUTURE', periodIndex: 0, field: 'endedAt' },
    });
  });
});

describe('latestCorrectionByDate', () => {
  const at = (iso: string) => new Date(iso);

  it('keeps the most recent correction of each day', () => {
    const latest = latestCorrectionByDate([
      { id: 1, workDate: '2026-11-03', status: 'refused', createdAt: at('2026-11-04T09:00:00Z') },
      { id: 2, workDate: '2026-11-03', status: 'accepted', createdAt: at('2026-11-05T09:00:00Z') },
      { id: 3, workDate: '2026-11-04', status: 'pending', createdAt: at('2026-11-05T09:00:00Z') },
    ]);

    expect(latest).toEqual(
      new Map([
        ['2026-11-03', { id: 2, status: 'accepted' }],
        ['2026-11-04', { id: 3, status: 'pending' }],
      ]),
    );
  });

  it('ignores superseded corrections', () => {
    const latest = latestCorrectionByDate([
      { id: 1, workDate: '2026-11-03', status: 'refused', createdAt: at('2026-11-04T09:00:00Z') },
      {
        id: 2,
        workDate: '2026-11-03',
        status: 'superseded',
        createdAt: at('2026-11-05T09:00:00Z'),
      },
    ]);

    expect(latest.get('2026-11-03')).toEqual({ id: 1, status: 'refused' });
  });

  it('breaks a tie on creation time with the id', () => {
    const sameTime = at('2026-11-04T09:00:00Z');

    const latest = latestCorrectionByDate([
      { id: 5, workDate: '2026-11-03', status: 'refused', createdAt: sameTime },
      { id: 4, workDate: '2026-11-03', status: 'accepted', createdAt: sameTime },
    ]);

    expect(latest.get('2026-11-03')?.id).toBe(5);
  });
});

describe('hasOpenRefusal', () => {
  it('is true when a counted day was last refused', () => {
    expect(
      hasOpenRefusal(new Map([['2026-11-03', { id: 1, status: 'refused' }]]), '2026-11-02'),
    ).toBe(true);
  });

  it('ignores a refusal before the counting start', () => {
    expect(
      hasOpenRefusal(new Map([['2026-11-03', { id: 1, status: 'refused' }]]), '2026-11-04'),
    ).toBe(false);
  });

  it('is false when the latest correction of every day is not a refusal', () => {
    expect(
      hasOpenRefusal(
        new Map([
          ['2026-11-03', { id: 2, status: 'accepted' }],
          ['2026-11-04', { id: 3, status: 'pending' }],
        ]),
        '2026-11-02',
      ),
    ).toBe(false);
  });
});
