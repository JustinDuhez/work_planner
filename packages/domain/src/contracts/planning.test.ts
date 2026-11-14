import { createCounterResetsRequestSchema, yearMonthSchema } from './planning';

describe('yearMonthSchema', () => {
  it.each(['2026-11', '2000-01', '2100-12'])('accepts %s', (value) => {
    expect(yearMonthSchema.safeParse(value).success).toBe(true);
  });

  it.each(['2026-13', '2026-1', '1999-12', '2101-01', 'novembre'])('refuses %s', (value) => {
    expect(yearMonthSchema.safeParse(value).success).toBe(false);
  });
});

describe('createCounterResetsRequestSchema', () => {
  it('accepts people and an optional date', () => {
    expect(
      createCounterResetsRequestSchema.parse({ userIds: [3, 4], resetDate: '2026-11-13' }),
    ).toEqual({
      userIds: [3, 4],
      resetDate: '2026-11-13',
    });
  });

  it.each([
    [{ userIds: [] }, 'Choisissez au moins une personne.'],
    [{ userIds: [3, 3] }, 'Une personne figure deux fois.'],
    [
      { userIds: Array.from({ length: 201 }, (_unused, index) => index + 1) },
      'Choisissez au plus 200 personnes.',
    ],
  ])('refuses %j in French', (body, message) => {
    const result = createCounterResetsRequestSchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('refuses unknown fields', () => {
    expect(createCounterResetsRequestSchema.safeParse({ userIds: [3], extra: true }).success).toBe(
      false,
    );
  });
});
