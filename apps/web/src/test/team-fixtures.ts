import type { TeamView } from '@work-planner/domain';

export function teamView(overrides: Partial<TeamView> = {}): TeamView {
  return {
    id: 3,
    name: 'Front',
    parentTeamId: null,
    manager: null,
    members: [],
    canManage: false,
    ...overrides,
  };
}
