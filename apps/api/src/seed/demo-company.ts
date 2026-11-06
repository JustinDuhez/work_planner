export interface DemoUser {
  email: string;
  firstName: string;
  lastName: string;
  isAdmin?: boolean;
  isBlocked?: boolean;
  isArchived?: boolean;
}

export interface DemoTeam {
  name: string;
  parentName?: string;
  managerEmail: string;
  memberEmails: string[];
}

/** Fictional company on the RFC 2606 reserved domain example.com. */
export const DEMO_USERS: readonly DemoUser[] = [
  { email: 'claire.martin@example.com', firstName: 'Claire', lastName: 'Martin' },
  { email: 'julien.bernard@example.com', firstName: 'Julien', lastName: 'Bernard' },
  { email: 'sophie.dubois@example.com', firstName: 'Sophie', lastName: 'Dubois' },
  { email: 'thomas.petit@example.com', firstName: 'Thomas', lastName: 'Petit' },
  { email: 'lea.moreau@example.com', firstName: 'Léa', lastName: 'Moreau' },
  { email: 'hugo.laurent@example.com', firstName: 'Hugo', lastName: 'Laurent' },
  { email: 'camille.simon@example.com', firstName: 'Camille', lastName: 'Simon' },
  { email: 'nicolas.michel@example.com', firstName: 'Nicolas', lastName: 'Michel' },
  { email: 'emma.lefebvre@example.com', firstName: 'Emma', lastName: 'Lefebvre' },
  { email: 'manon.roux@example.com', firstName: 'Manon', lastName: 'Roux' },
  { email: 'ines.garcia@example.com', firstName: 'Inès', lastName: 'Garcia', isAdmin: true },
  {
    email: 'lucas.fournier@example.com',
    firstName: 'Lucas',
    lastName: 'Fournier',
    isBlocked: true,
  },
  { email: 'chloe.girard@example.com', firstName: 'Chloé', lastName: 'Girard', isArchived: true },
];

/** Listed parents first: a team's parent must exist before the team. */
export const DEMO_TEAMS: readonly DemoTeam[] = [
  { name: 'Direction', managerEmail: 'claire.martin@example.com', memberEmails: [] },
  {
    name: 'Tech',
    parentName: 'Direction',
    managerEmail: 'julien.bernard@example.com',
    memberEmails: [],
  },
  {
    name: 'Front',
    parentName: 'Tech',
    managerEmail: 'sophie.dubois@example.com',
    memberEmails: ['lea.moreau@example.com', 'hugo.laurent@example.com'],
  },
  {
    name: 'Back',
    parentName: 'Tech',
    managerEmail: 'thomas.petit@example.com',
    memberEmails: [
      'hugo.laurent@example.com',
      'camille.simon@example.com',
      'chloe.girard@example.com',
    ],
  },
  {
    name: 'Commercial',
    parentName: 'Direction',
    managerEmail: 'nicolas.michel@example.com',
    memberEmails: ['emma.lefebvre@example.com', 'lucas.fournier@example.com'],
  },
  {
    name: 'RH',
    parentName: 'Direction',
    managerEmail: 'manon.roux@example.com',
    memberEmails: ['ines.garcia@example.com'],
  },
];
