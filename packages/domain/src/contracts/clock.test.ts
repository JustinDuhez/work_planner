import {
  startClockPeriodRequestSchema,
  updateClockDayRequestSchema,
  updateClockPeriodRequestSchema,
} from './clock';

describe('clock request contracts', () => {
  it('accepts a bare Start with no times', () => {
    expect(startClockPeriodRequestSchema.safeParse({}).success).toBe(true);
  });

  it('refuses an end time without a start time', () => {
    const result = startClockPeriodRequestSchema.safeParse({ endedAt: '12:00' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['startedAt']);
  });

  it.each(['9:00', '24:00', '12:60', 'noon'])('refuses the malformed time %s', (time) => {
    expect(startClockPeriodRequestSchema.safeParse({ startedAt: time }).success).toBe(false);
  });

  it('accepts "now" as an end time when editing (the Stop button)', () => {
    expect(updateClockPeriodRequestSchema.safeParse({ endedAt: 'now' }).success).toBe(true);
  });

  it('refuses an edit that changes nothing', () => {
    expect(updateClockPeriodRequestSchema.safeParse({}).success).toBe(false);
  });

  it('refuses unknown fields such as a user id', () => {
    expect(startClockPeriodRequestSchema.safeParse({ userId: 3 }).success).toBe(false);
  });

  it('only accepts the two work modes', () => {
    expect(updateClockDayRequestSchema.safeParse({ workMode: 'telework' }).success).toBe(true);
    expect(updateClockDayRequestSchema.safeParse({ workMode: 'beach' }).success).toBe(false);
  });
});
