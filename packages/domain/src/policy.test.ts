import {
  canEditDailyMinutes,
  canEditPastClock,
  canEditProfile,
  canManageHolidays,
  canManageSettings,
  canManageTeams,
  canManageUsers,
  canResetCounter,
  canReviewLeave,
  requiresCorrectionConsent,
  type Actor,
} from './policy';

// Org used by every case: the manager directly manages 10, and 11 via a sub-team.
const DIRECT_REPORT_ID = 10;
const SUB_TEAM_MEMBER_ID = 11;
const OUTSIDER_ID = 99;

const collaborator: Actor = {
  id: 1,
  isAdmin: false,
  isManager: false,
  managedUserIds: new Set(),
  directReportIds: new Set(),
};
const manager: Actor = {
  id: 2,
  isAdmin: false,
  isManager: true,
  managedUserIds: new Set([DIRECT_REPORT_ID, SUB_TEAM_MEMBER_ID]),
  directReportIds: new Set([DIRECT_REPORT_ID]),
};
const managerWithoutReports: Actor = {
  id: 3,
  isAdmin: false,
  isManager: true,
  managedUserIds: new Set(),
  directReportIds: new Set(),
};
const admin: Actor = {
  id: 4,
  isAdmin: true,
  isManager: false,
  managedUserIds: new Set(),
  directReportIds: new Set(),
};
const managerAndAdmin: Actor = { ...manager, id: 5, isAdmin: true };

type Relation = 'self' | 'direct report' | 'sub-team member' | 'outsider';

function targetFor(actor: Actor, relation: Relation): number {
  if (relation === 'self') return actor.id;
  if (relation === 'direct report') return DIRECT_REPORT_ID;
  if (relation === 'sub-team member') return SUB_TEAM_MEMBER_ID;
  return OUTSIDER_ID;
}

const ACTORS: Record<string, Actor> = {
  collaborator,
  manager,
  'manager without reports': managerWithoutReports,
  admin,
  'manager and admin': managerAndAdmin,
};

// Expected answer per actor for: self, direct report, sub-team member, outsider.
const TIME_RIGHTS: Record<string, [boolean, boolean, boolean, boolean]> = {
  collaborator: [false, false, false, false],
  manager: [true, true, true, false],
  'manager without reports': [true, false, false, false],
  admin: [true, true, true, true],
  'manager and admin': [true, true, true, true],
};
const LEAVE_REVIEW_RIGHTS: Record<string, [boolean, boolean, boolean, boolean]> = {
  collaborator: [false, false, false, false],
  manager: [false, true, false, false],
  'manager without reports': [false, false, false, false],
  admin: [false, true, true, true],
  'manager and admin': [false, true, true, true],
};
const RELATIONS: Relation[] = ['self', 'direct report', 'sub-team member', 'outsider'];

function cases(rights: Record<string, [boolean, boolean, boolean, boolean]>) {
  return Object.entries(rights).flatMap(([actorName, answers]) =>
    RELATIONS.map((relation, index) => [actorName, relation, answers[index]] as const),
  );
}

describe.each([
  ['canEditPastClock', canEditPastClock],
  ['canResetCounter', canResetCounter],
  ['canEditDailyMinutes', canEditDailyMinutes],
])('%s', (_name, rule) => {
  it.each(cases(TIME_RIGHTS))('%s acting on %s → %s', (actorName, relation, expected) => {
    const actor = ACTORS[actorName];
    if (!actor) throw new Error(`Unknown actor ${actorName}`);

    expect(rule(actor, targetFor(actor, relation))).toBe(expected);
  });
});

describe('canReviewLeave (direct manager or admin, never self)', () => {
  it.each(cases(LEAVE_REVIEW_RIGHTS))('%s reviewing %s → %s', (actorName, relation, expected) => {
    const actor = ACTORS[actorName];
    if (!actor) throw new Error(`Unknown actor ${actorName}`);

    expect(canReviewLeave(actor, targetFor(actor, relation))).toBe(expected);
  });
});

describe('requiresCorrectionConsent', () => {
  it('needs no consent when a manager corrects their own day', () => {
    expect(requiresCorrectionConsent(manager, manager.id)).toBe(false);
  });

  it('needs the employee consent when someone else corrects their day', () => {
    expect(requiresCorrectionConsent(manager, DIRECT_REPORT_ID)).toBe(true);
  });
});

describe('canEditProfile', () => {
  it('lets everyone edit their own profile', () => {
    expect(canEditProfile(collaborator, collaborator.id)).toBe(true);
  });

  it("does not let even an admin edit someone else's profile here", () => {
    expect(canEditProfile(admin, OUTSIDER_ID)).toBe(false);
  });
});

describe.each([
  ['canManageUsers', canManageUsers],
  ['canManageTeams', canManageTeams],
  ['canManageHolidays', canManageHolidays],
  ['canManageSettings', canManageSettings],
])('%s', (_name, rule) => {
  it.each([
    ['collaborator', collaborator, false],
    ['manager', manager, false],
    ['admin', admin, true],
    ['manager and admin', managerAndAdmin, true],
  ])('%s → %s', (_actorName, actor, expected) => {
    expect(rule(actor)).toBe(expected);
  });
});
