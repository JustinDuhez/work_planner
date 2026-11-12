import type { DayTypeView, LeaveRequestView } from '@work-planner/domain';

export const DAY_TYPES: DayTypeView[] = [
  {
    code: 'on_site',
    label: 'Sur site',
    color: '#94a3b8',
    requiresApproval: false,
    isBadgeable: true,
    isRequestable: false,
  },
  {
    code: 'telework',
    label: 'Télétravail',
    color: '#0ea5e9',
    requiresApproval: false,
    isBadgeable: true,
    isRequestable: true,
  },
  {
    code: 'sick',
    label: 'Maladie',
    color: '#ef4444',
    requiresApproval: true,
    isBadgeable: false,
    isRequestable: true,
  },
  {
    code: 'leave',
    label: 'Congé',
    color: '#10b981',
    requiresApproval: true,
    isBadgeable: false,
    isRequestable: true,
  },
  {
    code: 'early_departure',
    label: 'Départ anticipé',
    color: '#ec4899',
    requiresApproval: true,
    isBadgeable: false,
    isRequestable: true,
  },
];

export function leaveRequestView(overrides: Partial<LeaveRequestView> = {}): LeaveRequestView {
  return {
    id: 1,
    user: { id: 7, firstName: 'Léa', lastName: 'Moreau' },
    dayTypeCode: 'leave',
    startDate: '2026-11-23',
    startHalf: 'am',
    endDate: '2026-11-25',
    endHalf: 'pm',
    halfDayCount: 6,
    status: 'pending',
    reason: null,
    ruleNote: null,
    isAutoApproved: false,
    reviewer: null,
    reviewComment: null,
    reviewedAt: null,
    createdAt: '2026-11-12T09:00:00.000Z',
    canReview: false,
    canCancel: true,
    ...overrides,
  };
}
