import { liveGapMinutes } from './live-counters';

const SERVER_NOW = '2026-11-06T14:30:00.000Z';

describe('liveGapMinutes', () => {
  it('keeps the server gap when nothing is running', () => {
    expect(
      liveGapMinutes(-90, {
        runningSince: null,
        serverNow: SERVER_NOW,
        now: new Date('2026-11-06T15:30:00Z'),
      }),
    ).toBe(-90);
  });

  it('adds the minutes worked since the server answered while a period runs', () => {
    const timing = {
      runningSince: '2026-11-06T08:00:00.000Z',
      serverNow: SERVER_NOW,
      now: new Date('2026-11-06T15:00:00Z'),
    };

    expect(liveGapMinutes(-90, timing)).toBe(-60);
  });

  it('never goes backwards when the clock is behind the server answer', () => {
    const timing = {
      runningSince: '2026-11-06T08:00:00.000Z',
      serverNow: SERVER_NOW,
      now: new Date('2026-11-06T14:00:00Z'),
    };

    expect(liveGapMinutes(-90, timing)).toBe(-90);
  });
});
