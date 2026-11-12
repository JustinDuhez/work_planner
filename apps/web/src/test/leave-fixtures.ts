import type { DayTypeView } from '@work-planner/domain';

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
