export interface TeamLinkWithManager {
  id: number;
  name: string;
  parentTeamId: number | null;
  managerId: number | null;
  memberIds: number[];
}

export interface PlanningSection {
  teamId: number | null;
  title: string;
  rows: { personId: number; isManager: boolean }[];
}

const PATH_SEPARATOR = ' › ';

const byFrenchName = (first: { name: string }, second: { name: string }) =>
  first.name.localeCompare(second.name, 'fr');

/** Équipes page order (E2b): parents before sub-teams, siblings by French collation. */
export function orderTeams<T extends TeamLinkWithManager>(
  teams: readonly T[],
): (T & { path: string })[] {
  const ordered: (T & { path: string })[] = [];
  const visit = (parentId: number | null, parentPath: string | null) => {
    for (const team of teams
      .filter((candidate) => candidate.parentTeamId === parentId)
      .sort(byFrenchName)) {
      const path = parentPath === null ? team.name : `${parentPath}${PATH_SEPARATOR}${team.name}`;
      ordered.push({ ...team, path });
      visit(team.id, path);
    }
  };
  visit(null, null);
  return ordered;
}

export function groupPeopleByTeam(
  teams: readonly {
    id: number;
    path: string;
    managerId: number | null;
    memberIds: readonly number[];
  }[],
  people: readonly { id: number; firstName: string; lastName: string }[],
  noTeamTitle: string,
): PlanningSection[] {
  type Person = (typeof people)[number];
  const personById = new Map(people.map((person) => [person.id, person]));
  const byLastName = (first: Person, second: Person) =>
    first.lastName.localeCompare(second.lastName, 'fr') ||
    first.firstName.localeCompare(second.firstName, 'fr');
  const peopleOf = (ids: readonly number[]) =>
    ids
      .map((id) => personById.get(id))
      .filter((person): person is Person => person !== undefined)
      .sort(byLastName);

  const placed = new Set<number>();
  const sections: PlanningSection[] = teams.map((team) => {
    const rows: PlanningSection['rows'] = [];
    const manager = team.managerId === null ? undefined : personById.get(team.managerId);
    if (manager) {
      rows.push({ personId: manager.id, isManager: true });
      placed.add(manager.id);
    }
    const members = peopleOf(team.memberIds).filter((member) => member.id !== team.managerId);
    for (const member of members) {
      rows.push({ personId: member.id, isManager: false });
      placed.add(member.id);
    }
    return { teamId: team.id, title: team.path, rows };
  });
  const unplaced = people.filter((person) => !placed.has(person.id)).sort(byLastName);
  if (unplaced.length > 0) {
    sections.push({
      teamId: null,
      title: noTeamTitle,
      rows: unplaced.map((person) => ({ personId: person.id, isManager: false })),
    });
  }
  return sections;
}

/** E7: the team a person manages, else the first they belong to, else every team. */
export function defaultTeamFilter(
  teams: readonly { id: number; managerId: number | null; memberIds: readonly number[] }[],
  viewerId: number,
): number | 'all' {
  const managed = teams.find((team) => team.managerId === viewerId);
  const member = teams.find((team) => team.memberIds.includes(viewerId));
  return managed?.id ?? member?.id ?? 'all';
}
