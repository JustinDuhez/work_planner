import type { ClockDayView } from '@work-planner/domain';
import { liveDayMinutes } from './live-minutes';

const RUNNING_TODAY: ClockDayView = {
  date: '2026-11-06',
  workMode: 'on_site',
  periods: [
    { id: 1, startedAt: '2026-11-06T08:00:00.000Z', endedAt: '2026-11-06T11:00:00.000Z' },
    { id: 2, startedAt: '2026-11-06T12:00:00.000Z', endedAt: null },
  ],
  workedMinutes: 240,
  badgeableMinutes: 0,
  isToday: true,
  isFuture: false,
  isUnclosed: false,
  canEdit: true,
  canClose: false,
  canCorrect: false,
  latestCorrection: null,
};

describe('liveDayMinutes', () => {
  it("keeps today's running period ticking with the clock", () => {
    expect(liveDayMinutes(RUNNING_TODAY, new Date('2026-11-06T13:30:00Z'))).toBe(180 + 90);
  });

  it('uses the server total for any other day', () => {
    expect(
      liveDayMinutes({ ...RUNNING_TODAY, isToday: false, workedMinutes: 180 }, new Date()),
    ).toBe(180);
  });
});
