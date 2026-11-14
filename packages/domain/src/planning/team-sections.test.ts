import { defaultTeamFilter, groupPeopleByTeam, orderTeams } from './team-sections';

const TEAMS = [
  { id: 3, name: 'Front', parentTeamId: 1, managerId: 20, memberIds: [30, 31] },
  { id: 1, name: 'Tech', parentTeamId: null, managerId: 10, memberIds: [] },
  { id: 2, name: 'Équipe commerciale', parentTeamId: null, managerId: null, memberIds: [31, 40] },
];
const PEOPLE = [
  { id: 10, firstName: 'Claire', lastName: 'Martin' },
  { id: 20, firstName: 'Sophie', lastName: 'Dubois' },
  { id: 30, firstName: 'Léa', lastName: 'Moreau' },
  { id: 31, firstName: 'Hugo', lastName: 'Laurent' },
  { id: 40, firstName: 'Emma', lastName: 'Lefebvre' },
  { id: 50, firstName: 'Inès', lastName: 'Bernard' },
];

describe('orderTeams', () => {
  it('puts parents before their sub-teams, siblings in French order, with paths', () => {
    expect(orderTeams(TEAMS).map((team) => [team.id, team.path])).toEqual([
      [2, 'Équipe commerciale'],
      [1, 'Tech'],
      [3, 'Tech › Front'],
    ]);
  });
});

describe('groupPeopleByTeam', () => {
  const sections = groupPeopleByTeam(orderTeams(TEAMS), PEOPLE, 'Sans équipe');

  it('lists the manager first, then members by last name', () => {
    expect(sections.find((section) => section.teamId === 3)?.rows).toEqual([
      { personId: 20, isManager: true },
      { personId: 31, isManager: false },
      { personId: 30, isManager: false },
    ]);
  });

  it('breaks a tie on last name by first name', () => {
    const homonyms = [
      { id: 60, firstName: 'Zoé', lastName: 'Durand' },
      { id: 61, firstName: 'Adrien', lastName: 'Durand' },
    ];
    const [section] = groupPeopleByTeam(
      [{ id: 9, path: 'Tech', managerId: null, memberIds: [60, 61] }],
      homonyms,
      'Sans équipe',
    );
    expect(section?.rows.map((row) => row.personId)).toEqual([61, 60]);
  });

  it('shows a person in each of their teams', () => {
    const hugoSections = sections.filter((section) =>
      section.rows.some((row) => row.personId === 31),
    );
    expect(hugoSections.map((section) => section.teamId)).toEqual([2, 3]);
  });

  it('gathers people in no team last', () => {
    expect(sections.at(-1)).toEqual({
      teamId: null,
      title: 'Sans équipe',
      rows: [{ personId: 50, isManager: false }],
    });
  });

  it('leaves out the no-team section when everyone has a team', () => {
    const everyone = groupPeopleByTeam(orderTeams(TEAMS), PEOPLE.slice(0, 5), 'Sans équipe');
    expect(everyone.some((section) => section.teamId === null)).toBe(false);
  });
});

describe('defaultTeamFilter', () => {
  const ordered = orderTeams(TEAMS);

  it.each([
    ['a manager gets the team they manage', 20, 3],
    ['a member gets their first team', 31, 2],
    ['someone in no team gets every team', 50, 'all'],
  ])('%s', (_case, viewerId, filter) => {
    expect(defaultTeamFilter(ordered, viewerId)).toBe(filter);
  });
});
