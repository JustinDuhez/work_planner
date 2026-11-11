import { teamView } from '../test/team-fixtures';
import { buildTeamTree } from './team-tree';

describe('buildTeamTree', () => {
  it('nests teams under their parent and keeps the given order', () => {
    const tree = buildTeamTree([
      teamView({ id: 1, name: 'Direction' }),
      teamView({ id: 3, name: 'Back', parentTeamId: 1 }),
      teamView({ id: 2, name: 'Front', parentTeamId: 1 }),
      teamView({ id: 4, name: 'Mobile', parentTeamId: 2 }),
    ]);

    expect(tree.map((node) => node.team.name)).toEqual(['Direction']);
    expect(tree[0]?.children.map((node) => node.team.name)).toEqual(['Back', 'Front']);
    expect(tree[0]?.children[1]?.children.map((node) => node.team.name)).toEqual(['Mobile']);
  });

  it('shows a team whose parent is missing at the top level', () => {
    expect(buildTeamTree([teamView({ id: 2, parentTeamId: 99 })])).toHaveLength(1);
  });
});
