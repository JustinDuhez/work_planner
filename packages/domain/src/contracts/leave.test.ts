import { createLeaveRequestRequestSchema } from './leave';

const REQUEST = {
  dayTypeCode: 'leave',
  startDate: '2026-11-23',
  startHalf: 'am',
  endDate: '2026-11-25',
  endHalf: 'pm',
};

describe('leave contracts', () => {
  it('accepts a request and trims the reason', () => {
    expect(
      createLeaveRequestRequestSchema.parse({ ...REQUEST, reason: '  Rendez-vous ' }).reason,
    ).toBe('Rendez-vous');
  });

  it('refuses an unknown half and unknown fields', () => {
    expect(
      createLeaveRequestRequestSchema.safeParse({ ...REQUEST, startHalf: 'noon' }).success,
    ).toBe(false);
    expect(createLeaveRequestRequestSchema.safeParse({ ...REQUEST, userId: 9 }).success).toBe(
      false,
    );
  });

  it('refuses a reason over 500 characters', () => {
    expect(
      createLeaveRequestRequestSchema.safeParse({ ...REQUEST, reason: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});
