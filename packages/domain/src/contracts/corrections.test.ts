import {
  answerClockCorrectionRequestSchema,
  createClockCorrectionRequestSchema,
} from './corrections';
import { markNotificationReadRequestSchema } from './notifications';

const VALID = {
  userId: 3,
  date: '2026-11-03',
  workMode: 'on_site',
  periods: [{ startedAt: '09:00', endedAt: '12:00' }],
};

describe('correction contracts', () => {
  it('accepts a whole day with an optional comment', () => {
    expect(
      createClockCorrectionRequestSchema.safeParse({ ...VALID, comment: 'Réunion oubliée' })
        .success,
    ).toBe(true);
  });

  it('accepts a day emptied of every period', () => {
    expect(createClockCorrectionRequestSchema.safeParse({ ...VALID, periods: [] }).success).toBe(
      true,
    );
  });

  it('refuses a period without an end', () => {
    const result = createClockCorrectionRequestSchema.safeParse({
      ...VALID,
      periods: [{ startedAt: '09:00' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['periods', 0, 'endedAt']);
  });

  it('refuses a comment longer than 500 characters', () => {
    expect(
      createClockCorrectionRequestSchema.safeParse({ ...VALID, comment: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('refuses unknown fields', () => {
    expect(
      createClockCorrectionRequestSchema.safeParse({ ...VALID, status: 'accepted' }).success,
    ).toBe(false);
  });

  it('answers only accepted or refused', () => {
    expect(
      answerClockCorrectionRequestSchema.safeParse({ status: 'refused', responseComment: 'Non' })
        .success,
    ).toBe(true);
    expect(answerClockCorrectionRequestSchema.safeParse({ status: 'superseded' }).success).toBe(
      false,
    );
  });

  it('only marks a notification as read', () => {
    expect(markNotificationReadRequestSchema.safeParse({ isRead: true }).success).toBe(true);
    expect(markNotificationReadRequestSchema.safeParse({ isRead: false }).success).toBe(false);
  });
});
