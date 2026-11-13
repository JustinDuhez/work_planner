import type { YearCalendar } from '@work-planner/domain';

export function yearCalendar(overrides: Partial<YearCalendar> = {}): YearCalendar {
  return {
    user: { id: 7, firstName: 'Léa', lastName: 'Moreau' },
    period: { startDate: '2026-07-01', endDate: '2027-06-30' },
    halfDays: [],
    holidays: [],
    summary: [],
    holidayCount: 0,
    canDeclare: false,
    today: '2026-11-13',
    ...overrides,
  };
}
