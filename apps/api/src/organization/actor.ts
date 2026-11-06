import type { Actor } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { findDirectReportIds, findManagedUserIds, isTeamManager } from './scope-repository';

export async function loadActor(
  db: Kysely<Database>,
  user: { id: number; isAdmin: boolean },
): Promise<Actor> {
  const [isManager, managedUserIds, directReportIds] = await Promise.all([
    isTeamManager(db, user.id),
    findManagedUserIds(db, user.id),
    findDirectReportIds(db, user.id),
  ]);
  return { id: user.id, isAdmin: user.isAdmin, isManager, managedUserIds, directReportIds };
}
