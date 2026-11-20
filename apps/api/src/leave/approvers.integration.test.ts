import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { insertTeam, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import { findLeaveApproverIds } from './approvers';

describe('finding who can approve a leave request', () => {
  let db: Kysely<Database>;
  let adminId: number;
  let n = 0;

  const user = (overrides: object = {}) =>
    insertUser(db, { email: `u${(n += 1)}@approvers.test`, ...overrides });

  beforeAll(async () => {
    db = await createMigratedTestDb();
    adminId = await user({ isAdmin: true });
    await user({ isAdmin: true, isBlocked: true });
    await user({ isAdmin: true, isArchived: true });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('is the direct manager and every active admin', async () => {
    const managerId = await user();
    const memberId = await user();
    await insertTeam(db, { name: 'A1', managerId, memberIds: [memberId] });

    expect(await findLeaveApproverIds(db, memberId)).toEqual(
      [adminId, managerId].sort((a, b) => a - b),
    );
  });

  it('is the admins alone for a member without a team', async () => {
    expect(await findLeaveApproverIds(db, await user())).toEqual([adminId]);
  });

  it('leaves out a blocked or archived manager', async () => {
    const blockedId = await user({ isBlocked: true });
    const archivedId = await user({ isArchived: true });
    const memberId = await user();
    await insertTeam(db, { name: 'A2', managerId: blockedId, memberIds: [memberId] });
    await insertTeam(db, { name: 'A3', managerId: archivedId, memberIds: [memberId] });

    expect(await findLeaveApproverIds(db, memberId)).toEqual([adminId]);
  });

  it('does not include the manager of a parent team', async () => {
    const parentManagerId = await user();
    const parentId = await insertTeam(db, { name: 'A4', managerId: parentManagerId });
    const memberId = await user();
    await insertTeam(db, { name: 'A5', parentTeamId: parentId, memberIds: [memberId] });

    expect(await findLeaveApproverIds(db, memberId)).toEqual([adminId]);
  });

  // Last: it leaves a second admin behind for the other tests.
  it('never includes the requester, even an admin, while the other admins stay', async () => {
    const otherAdminId = await user({ isAdmin: true });

    expect(await findLeaveApproverIds(db, otherAdminId)).toEqual([adminId]);
  });
});
