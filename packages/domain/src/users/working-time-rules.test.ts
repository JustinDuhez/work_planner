import { planDailyMinutesChange, workingTimeOf } from './working-time-rules';

const TODAY = '2026-11-10';

describe('planDailyMinutesChange', () => {
  it('records a change from today with the value in force before it', () => {
    expect(
      planDailyMinutesChange({
        effectiveDate: TODAY,
        today: TODAY,
        currentDailyMinutes: 420,
        changes: [],
      }),
    ).toEqual({ kind: 'insert', previousDailyMinutes: 420 });
  });

  it('plans a change for a later date', () => {
    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-16',
        today: TODAY,
        currentDailyMinutes: 420,
        changes: [],
      }),
    ).toEqual({ kind: 'insert', previousDailyMinutes: 420 });
  });

  it('refuses a date in the past', () => {
    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-09',
        today: TODAY,
        currentDailyMinutes: 420,
        changes: [],
      }),
    ).toEqual({ kind: 'refused', reason: 'DATE_IN_PAST' });
  });

  it('refuses a date before the latest existing change', () => {
    const changes = [{ effectiveDate: '2026-11-20', previousDailyMinutes: 420 }];

    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-16',
        today: TODAY,
        currentDailyMinutes: 360,
        changes,
      }),
    ).toEqual({ kind: 'refused', reason: 'CHANGE_ORDER' });
  });

  it('compares with the latest change even when the history is not in date order', () => {
    const changes = [
      { effectiveDate: '2026-11-23', previousDailyMinutes: 360 },
      { effectiveDate: '2026-11-16', previousDailyMinutes: 420 },
    ];

    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-18',
        today: TODAY,
        currentDailyMinutes: 300,
        changes,
      }),
    ).toEqual({ kind: 'refused', reason: 'CHANGE_ORDER' });
  });

  it('keeps the existing row when the date matches the latest change', () => {
    const changes = [{ effectiveDate: '2026-11-16', previousDailyMinutes: 420 }];

    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-16',
        today: TODAY,
        currentDailyMinutes: 360,
        changes,
      }),
    ).toEqual({ kind: 'keepExisting' });
  });

  it('chains a change after an existing one with the value in force the day before', () => {
    const changes = [{ effectiveDate: '2026-11-16', previousDailyMinutes: 420 }];

    expect(
      planDailyMinutesChange({
        effectiveDate: '2026-11-23',
        today: TODAY,
        currentDailyMinutes: 360,
        changes,
      }),
    ).toEqual({ kind: 'insert', previousDailyMinutes: 360 });
  });
});

describe('workingTimeOf', () => {
  it('shows the current daily time when nothing is planned', () => {
    expect(
      workingTimeOf({
        today: TODAY,
        currentDailyMinutes: 420,
        startDate: '2026-10-12',
        changes: [],
      }),
    ).toEqual({ dailyMinutes: 420, startDate: '2026-10-12', plannedChange: null });
  });

  it('shows the value in force today and the next planned change', () => {
    const changes = [
      { effectiveDate: '2026-11-02', previousDailyMinutes: 450 },
      { effectiveDate: '2026-11-16', previousDailyMinutes: 420 },
      { effectiveDate: '2026-11-23', previousDailyMinutes: 360 },
    ];

    expect(
      workingTimeOf({ today: TODAY, currentDailyMinutes: 300, startDate: '2026-10-12', changes }),
    ).toEqual({
      dailyMinutes: 420,
      startDate: '2026-10-12',
      plannedChange: { effectiveDate: '2026-11-16', dailyMinutes: 360 },
    });
  });

  it('treats a change dated today as already in force, not planned', () => {
    const changes = [{ effectiveDate: TODAY, previousDailyMinutes: 420 }];

    expect(
      workingTimeOf({ today: TODAY, currentDailyMinutes: 360, startDate: '2026-10-12', changes })
        .plannedChange,
    ).toBeNull();
  });
});
