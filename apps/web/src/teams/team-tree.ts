import type { TeamView } from '@work-planner/domain';

export interface TeamNode {
  team: TeamView;
  children: TeamNode[];
}

/** The API sends a flat list sorted by name; nesting keeps that order at every level. */
export function buildTeamTree(teams: readonly TeamView[]): TeamNode[] {
  const nodeById = new Map(teams.map((team) => [team.id, { team, children: [] as TeamNode[] }]));
  const roots: TeamNode[] = [];
  for (const node of nodeById.values()) {
    const parent =
      node.team.parentTeamId === null ? undefined : nodeById.get(node.team.parentTeamId);
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
