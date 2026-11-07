import { toWorkDate } from '@work-planner/domain';
import { weekFixture } from '../test/clock-fixtures';
import { hasRunningPeriod } from './clock-queries';
import { APP_TIME_ZONE } from './clock-time';

const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
const OPEN = { id: 1, startedAt: '2026-11-06T08:00:00.000Z', endedAt: null };
const CLOSED = { ...OPEN, endedAt: '2026-11-06T09:00:00.000Z' };

describe('hasRunningPeriod', () => {
  it('is true while today has an open period', () => {
    expect(hasRunningPeriod(weekFixture({ days: { [TODAY]: { periods: [OPEN] } } }))).toBe(true);
  });

  it('is false when today has only closed periods', () => {
    expect(hasRunningPeriod(weekFixture({ days: { [TODAY]: { periods: [CLOSED] } } }))).toBe(false);
  });

  it('is false for an unclosed past day', () => {
    const week = weekFixture({ isoWeek: '2026-W45', days: { '2026-11-02': { periods: [OPEN] } } });
    expect(hasRunningPeriod(week)).toBe(false);
  });

  it('is false before the week is loaded', () => {
    expect(hasRunningPeriod(undefined)).toBe(false);
  });
});
