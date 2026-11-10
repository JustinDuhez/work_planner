import {
  createUserRequestSchema,
  updateUserRequestSchema,
  updateWorkingTimeRequestSchema,
} from './users';

const NEW_USER = {
  firstName: ' Zoé ',
  lastName: 'Adam',
  email: ' Zoe.Adam@Example.com ',
  isAdmin: false,
  initialPassword: 'correct horse battery',
};

describe('user contracts', () => {
  it('normalizes names and email of a new user', () => {
    const parsed = createUserRequestSchema.parse(NEW_USER);

    expect(parsed).toMatchObject({ firstName: 'Zoé', email: 'zoe.adam@example.com' });
  });

  it('refuses an invalid email with a field message', () => {
    const result = createUserRequestSchema.safeParse({ ...NEW_USER, email: 'zoe' });

    expect(result.error?.issues[0]?.path).toEqual(['email']);
  });

  it.each([0, 1441, 6.5])('refuses the daily time %s', (dailyMinutes) => {
    expect(createUserRequestSchema.safeParse({ ...NEW_USER, dailyMinutes }).success).toBe(false);
  });

  it('refuses an edit that changes nothing', () => {
    expect(updateUserRequestSchema.safeParse({}).success).toBe(false);
  });

  it('refuses an effective date without a daily time', () => {
    expect(updateWorkingTimeRequestSchema.safeParse({ effectiveDate: '2026-11-16' }).success).toBe(
      false,
    );
  });

  it('accepts a start date alone', () => {
    expect(updateWorkingTimeRequestSchema.safeParse({ startDate: '2026-11-02' }).success).toBe(
      true,
    );
  });

  it('refuses unknown fields such as a password hash', () => {
    expect(updateUserRequestSchema.safeParse({ passwordHash: 'x' }).success).toBe(false);
  });
});
