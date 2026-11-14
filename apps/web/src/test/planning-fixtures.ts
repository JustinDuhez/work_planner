import type { TeamMonth } from '@work-planner/domain';

export function teamMonth(overrides: Partial<TeamMonth> = {}): TeamMonth {
  return {
    month: { startDate: '2026-11-01', endDate: '2026-11-30' },
    today: '2026-11-13',
    holidays: [{ date: '2026-11-11', label: 'Armistice' }],
    teams: [
      { id: 1, name: 'Tech', parentTeamId: null, path: 'Tech', managerId: 10, memberIds: [] },
      {
        id: 3,
        name: 'Front',
        parentTeamId: 1,
        path: 'Tech › Front',
        managerId: 2,
        memberIds: [7, 9],
      },
    ],
    people: [
      {
        id: 10,
        firstName: 'Claire',
        lastName: 'Martin',
        teamIds: [1],
        halfDays: [],
        balance: { globalGapMinutes: 0, hasOpenRefusal: false },
      },
      {
        id: 2,
        firstName: 'Sophie',
        lastName: 'Dubois',
        teamIds: [3],
        halfDays: [],
        balance: { globalGapMinutes: 45, hasOpenRefusal: false },
      },
      {
        id: 7,
        firstName: 'Léa',
        lastName: 'Moreau',
        teamIds: [3],
        halfDays: [
          { date: '2026-11-13', half: 'am', dayTypeCode: 'leave', status: 'approved' },
          { date: '2026-11-13', half: 'pm', dayTypeCode: 'leave', status: 'approved' },
          { date: '2026-11-23', half: 'pm', dayTypeCode: 'telework', status: 'pending' },
        ],
        balance: { globalGapMinutes: -90, hasOpenRefusal: false },
      },
      {
        id: 9,
        firstName: 'Hugo',
        lastName: 'Laurent',
        teamIds: [3],
        halfDays: [],
        balance: { globalGapMinutes: -30, hasOpenRefusal: true },
      },
      {
        id: 12,
        firstName: 'Inès',
        lastName: 'Bernard',
        teamIds: [],
        halfDays: [],
        balance: { globalGapMinutes: 0, hasOpenRefusal: false },
      },
    ],
    canResetUserIds: [],
    absentTodayUserIds: [7],
    ...overrides,
  };
}
