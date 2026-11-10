import {
  canEditDailyMinutes,
  canManageUsers,
  toWorkDate,
  workingTimeOf,
  type Actor,
  type DailyMinutesChange,
  type DirectoryEntry,
} from '@work-planner/domain';
import { sql, type Kysely } from 'kysely';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { UserManagementForbiddenError, UserNotFoundError } from './user-errors';

interface DirectoryUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  isBlocked: boolean;
  archivedAt: Date | null;
  dailyMinutes: number;
  startDate: string;
}

interface TeamLink {
  userId: number;
  teamId: number;
  teamName: string;
  managerId: number | null;
  isOwnTeam: boolean;
}

function findDirectoryUsers(db: Kysely<Database>, query: { isArchived: boolean; userId?: number }) {
  let select = db
    .selectFrom('appUser')
    .select([
      'id',
      'firstName',
      'lastName',
      'email',
      'isAdmin',
      'isBlocked',
      'archivedAt',
      'dailyMinutes',
      'startDate',
    ])
    .where('archivedAt', query.isArchived ? 'is not' : 'is', null);
  if (query.userId !== undefined) select = select.where('id', '=', query.userId);
  return select.orderBy('lastName').orderBy('firstName').execute();
}

/**
 * One query for every team link: membership (manager = the team's manager) and management
 * (manager = the parent team's manager), the same rule as E1's findDirectManagerIds.
 */
async function findTeamLinks(db: Kysely<Database>): Promise<TeamLink[]> {
  const { rows } = await sql<TeamLink>`
    SELECT team_member.user_id, team.id AS team_id, team.name AS team_name, team.manager_id, FALSE AS is_own_team
    FROM team_member JOIN team ON team.id = team_member.team_id
    UNION ALL
    SELECT child.manager_id AS user_id, child.id AS team_id, child.name AS team_name, parent.manager_id, TRUE AS is_own_team
    FROM team AS child LEFT JOIN team AS parent ON parent.id = child.parent_team_id
    WHERE child.manager_id IS NOT NULL
  `.execute(db);
  return rows;
}

function findChangesByUser(
  db: Kysely<Database>,
): Promise<{ userId: number; effectiveDate: string; previousDailyMinutes: number }[]> {
  return db
    .selectFrom('dailyMinutesChange')
    .select(['userId', 'effectiveDate', 'previousDailyMinutes'])
    .execute();
}

function toEntry(
  user: DirectoryUser,
  context: {
    actor: Actor;
    links: readonly TeamLink[];
    activeUsers: ReadonlyMap<number, DirectoryUser>;
    changes: readonly DailyMinutesChange[];
    today: string;
  },
): DirectoryEntry {
  const ownLinks = context.links.filter((link) => link.userId === user.id);
  const teams = [
    ...new Map(
      ownLinks.map((link) => [link.teamId, { id: link.teamId, name: link.teamName }]),
    ).values(),
  ].sort((first, second) => first.name.localeCompare(second.name, 'fr'));
  const managerIds = new Set(
    ownLinks
      .map((link) => link.managerId)
      .filter((id): id is number => id !== null && id !== user.id),
  );
  const managers = [...managerIds]
    .map((id) => context.activeUsers.get(id))
    .filter((manager): manager is DirectoryUser => manager !== undefined)
    .map(({ id, firstName, lastName }) => ({ id, firstName, lastName }));
  const canEditWorkingTime = canEditDailyMinutes(context.actor, user.id);
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isAdmin: user.isAdmin,
    isManager: ownLinks.some((link) => link.isOwnTeam),
    isBlocked: user.isBlocked,
    isArchived: user.archivedAt !== null,
    teams,
    managers,
    canManage: canManageUsers(context.actor),
    canEditWorkingTime,
    workingTime: canEditWorkingTime
      ? workingTimeOf({
          today: context.today,
          currentDailyMinutes: user.dailyMinutes,
          startDate: user.startDate,
          changes: context.changes,
        })
      : null,
  };
}

async function buildEntries(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; isArchived: boolean; userId?: number },
): Promise<DirectoryEntry[]> {
  const [actor, users, activeUsers, links, changes] = await Promise.all([
    query.viewer.loadActor(),
    findDirectoryUsers(deps.db, { isArchived: query.isArchived, userId: query.userId }),
    findDirectoryUsers(deps.db, { isArchived: false }),
    findTeamLinks(deps.db),
    findChangesByUser(deps.db),
  ]);
  const activeById = new Map(activeUsers.map((user) => [user.id, user]));
  const today = toWorkDate(deps.now(), deps.timeZone);
  return users.map((user) =>
    toEntry(user, {
      actor,
      links,
      activeUsers: activeById,
      changes: changes.filter((change) => change.userId === user.id),
      today,
    }),
  );
}

export async function loadDirectory(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; includeArchived: boolean },
): Promise<DirectoryEntry[]> {
  if (query.includeArchived && !canManageUsers(await query.viewer.loadActor())) {
    throw new UserManagementForbiddenError();
  }
  return buildEntries(deps, { viewer: query.viewer, isArchived: query.includeArchived });
}

/** The entry returned by every admin action; archived people are visible to admins only. */
export async function loadDirectoryEntry(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; userId: number },
): Promise<DirectoryEntry> {
  const [active] = await buildEntries(deps, {
    viewer: query.viewer,
    isArchived: false,
    userId: query.userId,
  });
  if (active) return active;
  const canSeeArchived = canManageUsers(await query.viewer.loadActor());
  const [archived] = canSeeArchived
    ? await buildEntries(deps, { viewer: query.viewer, isArchived: true, userId: query.userId })
    : [];
  if (!archived) throw new UserNotFoundError();
  return archived;
}
