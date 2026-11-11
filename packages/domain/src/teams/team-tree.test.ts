import { isInSubtree } from './team-tree';

// Direction ─ Front ─ Mobile ; Direction ─ Back ; Commercial (top level)
const TEAMS = [
  { id: 1, parentTeamId: null },
  { id: 2, parentTeamId: 1 },
  { id: 3, parentTeamId: 2 },
  { id: 4, parentTeamId: 1 },
  { id: 5, parentTeamId: null },
];

describe('isInSubtree', () => {
  it('counts the team itself', () => {
    expect(isInSubtree(TEAMS, 2, 2)).toBe(true);
  });

  it('finds a child and a grandchild', () => {
    expect(isInSubtree(TEAMS, 1, 2)).toBe(true);
    expect(isInSubtree(TEAMS, 1, 3)).toBe(true);
  });

  it('does not count a sibling, a parent or an unrelated team', () => {
    expect(isInSubtree(TEAMS, 2, 4)).toBe(false);
    expect(isInSubtree(TEAMS, 2, 1)).toBe(false);
    expect(isInSubtree(TEAMS, 2, 5)).toBe(false);
  });

  it('stops on a corrupted loop instead of spinning', () => {
    const looped = [
      { id: 7, parentTeamId: 8 },
      { id: 8, parentTeamId: 7 },
    ];

    expect(isInSubtree(looped, 1, 7)).toBe(false);
  });
});
