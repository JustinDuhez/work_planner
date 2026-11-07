import { toLocalTime, toWorkDate } from '@work-planner/domain';
import { buildDemoClockHistory } from './demo-clock-history';

const PARIS = 'Europe/Paris';
const EMAILS = ['lea.moreau@example.com', 'hugo.laurent@example.com', 'emma.lefebvre@example.com'];
// Friday 6 November 2026, 10:30 in Paris.
const MORNING = new Date('2026-11-06T09:30:00Z');

describe('buildDemoClockHistory', () => {
  const history = buildDemoClockHistory({ now: MORNING, timeZone: PARIS, emails: EMAILS });

  it('is identical on every run for the same date', () => {
    expect(buildDemoClockHistory({ now: MORNING, timeZone: PARIS, emails: EMAILS })).toEqual(
      history,
    );
  });

  it('covers weekdays of the three previous weeks and of this week up to today', () => {
    const leaDates = history.filter((day) => day.email === EMAILS[0]).map((day) => day.workDate);

    expect(leaDates[0]).toBe('2026-10-12');
    // Today is left to the person (only Hugo's running day is seeded today).
    expect(leaDates.at(-1)).toBe('2026-11-05');
    expect(leaDates).not.toContain('2026-10-17');
  });

  it("leaves Léa's Thursday of last week unclosed", () => {
    const thursday = history.find(
      (day) => day.email === EMAILS[0] && day.workDate === '2026-10-29',
    );

    expect(thursday?.periods.at(-1)?.endedAt).toBeNull();
  });

  it('has Hugo clocked in since 9:00 today', () => {
    const today = history.find((day) => day.email === EMAILS[1] && day.workDate === '2026-11-06');

    expect(today?.periods).toEqual([
      { startedAt: new Date('2026-11-06T08:00:00Z'), endedAt: null },
    ]);
  });

  it('never creates a period in the future', () => {
    const allPeriods = history.flatMap((day) => day.periods);

    expect(
      allPeriods.every(
        (period) => period.startedAt <= MORNING && (period.endedAt ?? MORNING) <= MORNING,
      ),
    ).toBe(true);
  });

  it('leaves today empty when seeding before 9:00', () => {
    const early = buildDemoClockHistory({
      now: new Date('2026-11-06T06:00:00Z'),
      timeZone: PARIS,
      emails: EMAILS,
    });

    expect(early.some((day) => day.workDate === '2026-11-06')).toBe(false);
  });

  it('keeps every period inside its own Paris day', () => {
    expect(
      history.every((day) =>
        day.periods.every((period) => toWorkDate(period.startedAt, PARIS) === day.workDate),
      ),
    ).toBe(true);
    expect(toLocalTime(history[0]?.periods[0]?.startedAt ?? MORNING, PARIS)).toMatch(
      /^0[89]:\d\d$/,
    );
  });
});
