import type { DirectoryEntry } from '@work-planner/domain';

export function directoryEntry(overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return {
    id: 7,
    firstName: 'Léa',
    lastName: 'Moreau',
    email: 'lea.moreau@example.com',
    isAdmin: false,
    isManager: false,
    isBlocked: false,
    isArchived: false,
    teams: [{ id: 3, name: 'Front' }],
    managers: [{ id: 2, firstName: 'Sophie', lastName: 'Dubois' }],
    canManage: false,
    canEditWorkingTime: false,
    workingTime: null,
    ...overrides,
  };
}
