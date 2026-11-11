export interface TeamLink {
  id: number;
  parentTeamId: number | null;
}

/**
 * Whether `candidateId` is `rootId` or one of its descendants: placing `rootId` under such a
 * team would close a loop (E1 §8 carry-forward). Walks up from the candidate; a corrupted loop
 * in the data stops the walk instead of spinning.
 */
export function isInSubtree(
  teams: readonly TeamLink[],
  rootId: number,
  candidateId: number,
): boolean {
  const parentById = new Map(teams.map((team) => [team.id, team.parentTeamId]));
  const visitedIds = new Set<number>();
  let currentId: number | null | undefined = candidateId;
  while (currentId !== null && currentId !== undefined && !visitedIds.has(currentId)) {
    if (currentId === rootId) return true;
    visitedIds.add(currentId);
    currentId = parentById.get(currentId);
  }
  return false;
}
