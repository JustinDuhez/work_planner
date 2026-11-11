import { createPublicHolidayRequestSchema, publicHolidayImportRequestSchema } from './holidays';
import { createTeamRequestSchema, updateTeamRequestSchema } from './teams';

describe('team and holiday contracts', () => {
  it('trims a team name and accepts a top-level team without manager', () => {
    expect(createTeamRequestSchema.parse({ name: '  Front ', parentTeamId: null })).toEqual({
      name: 'Front',
      parentTeamId: null,
    });
  });

  it('refuses an empty team name with a field message', () => {
    expect(createTeamRequestSchema.safeParse({ name: '  ' }).error?.issues[0]?.path).toEqual([
      'name',
    ]);
  });

  it('refuses an edit that changes nothing and unknown fields', () => {
    expect(updateTeamRequestSchema.safeParse({}).success).toBe(false);
    expect(updateTeamRequestSchema.safeParse({ name: 'A', color: 'red' }).success).toBe(false);
  });

  it('accepts clearing the parent and the manager', () => {
    expect(updateTeamRequestSchema.parse({ parentTeamId: null, managerId: null })).toEqual({
      parentTeamId: null,
      managerId: null,
    });
  });

  it('trims a holiday label and refuses an empty one', () => {
    expect(
      createPublicHolidayRequestSchema.parse({ date: '2026-12-24', label: ' Réveillon ' }).label,
    ).toBe('Réveillon');
    expect(
      createPublicHolidayRequestSchema.safeParse({ date: '2026-12-24', label: '' }).success,
    ).toBe(false);
  });

  it.each([1999, 2101, 2026.5])('refuses the import year %s', (year) => {
    expect(publicHolidayImportRequestSchema.safeParse({ year }).success).toBe(false);
  });
});
