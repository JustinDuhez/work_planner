import type { SessionResponse } from '@work-planner/domain';

export const SIGNED_IN_SESSION: SessionResponse = {
  csrfToken: 'csrf-test-token',
  user: {
    id: 7,
    email: 'lea.moreau@example.com',
    firstName: 'Léa',
    lastName: 'Moreau',
    dailyMinutes: 420,
    roles: { isAdmin: false, isManager: false },
    teams: [{ id: 3, name: 'Front', isManager: false }],
    directManagers: [{ id: 2, firstName: 'Sophie', lastName: 'Dubois' }],
    mustChangePassword: false,
  },
};
