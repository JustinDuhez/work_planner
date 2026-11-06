import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { insertTeam, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import { loadActor } from './actor';
import {
  findDirectManagerIds,
  findDirectReportIds,
  findManagedUserIds,
  isTeamManager,
} from './scope-repository';

/**
 * Direction (dir)
 * ├── Tech (techLead): bob
 * │   └── Front (frontLead): alice, carol, archivedDan
 * └── Commercial (salesLead): carol, eve
 */
describe('team scope', () => {
  let db: Kysely<Database>;
  const ids: Record<string, number> = {};

  function idsOf(...names: string[]): Set<number> {
    return new Set(names.map((name) => ids[name] ?? -1));
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    for (const name of [
      'dir',
      'techLead',
      'frontLead',
      'salesLead',
      'alice',
      'bob',
      'carol',
      'eve',
    ]) {
      ids[name] = await insertUser(db, { email: `${name.toLowerCase()}@example.com` });
    }
    ids.archivedDan = await insertUser(db, { email: 'archived.dan@example.com', isArchived: true });
    const directionId = await insertTeam(db, { name: 'Direction', managerId: ids.dir });
    const techId = await insertTeam(db, {
      name: 'Tech',
      parentTeamId: directionId,
      managerId: ids.techLead,
      memberIds: [ids.bob ?? -1],
    });
    await insertTeam(db, {
      name: 'Front',
      parentTeamId: techId,
      managerId: ids.frontLead,
      memberIds: [ids.alice ?? -1, ids.carol ?? -1, ids.archivedDan ?? -1],
    });
    await insertTeam(db, {
      name: 'Commercial',
      parentTeamId: directionId,
      managerId: ids.salesLead,
      memberIds: [ids.carol ?? -1, ids.eve ?? -1],
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('findManagedUserIds (recursive)', () => {
    it('gives the top manager everyone below, sub-team managers included', async () => {
      expect(await findManagedUserIds(db, ids.dir ?? -1)).toEqual(
        idsOf('techLead', 'frontLead', 'salesLead', 'alice', 'bob', 'carol', 'eve'),
      );
    });

    it('gives a middle manager their team and their sub-team', async () => {
      expect(await findManagedUserIds(db, ids.techLead ?? -1)).toEqual(
        idsOf('bob', 'frontLead', 'alice', 'carol'),
      );
    });

    it('leaves archived members out of every scope', async () => {
      expect(await findManagedUserIds(db, ids.frontLead ?? -1)).toEqual(idsOf('alice', 'carol'));
    });

    it('gives a collaborator an empty scope', async () => {
      expect(await findManagedUserIds(db, ids.alice ?? -1)).toEqual(new Set());
    });
  });

  describe('findDirectReportIds', () => {
    it('gives the top manager only the managers of the teams just below', async () => {
      expect(await findDirectReportIds(db, ids.dir ?? -1)).toEqual(idsOf('techLead', 'salesLead'));
    });

    it('gives a middle manager their members and the next sub-team manager', async () => {
      expect(await findDirectReportIds(db, ids.techLead ?? -1)).toEqual(idsOf('bob', 'frontLead'));
    });
  });

  describe('findDirectManagerIds', () => {
    it('gives a member of two teams both team managers', async () => {
      expect(await findDirectManagerIds(db, ids.carol ?? -1)).toEqual(
        idsOf('frontLead', 'salesLead'),
      );
    });

    it('gives a team manager the manager of the parent team', async () => {
      expect(await findDirectManagerIds(db, ids.techLead ?? -1)).toEqual(idsOf('dir'));
    });

    it('gives the top manager nobody', async () => {
      expect(await findDirectManagerIds(db, ids.dir ?? -1)).toEqual(new Set());
    });
  });

  it('terminates even if a cycle slipped into the team hierarchy', async () => {
    const loopManagerId = await insertUser(db, { email: 'loop.manager@example.com' });
    const loopMemberId = await insertUser(db, { email: 'loop.member@example.com' });
    const firstId = await insertTeam(db, { name: 'Boucle A', managerId: loopManagerId });
    const secondId = await insertTeam(db, {
      name: 'Boucle B',
      parentTeamId: firstId,
      memberIds: [loopMemberId],
    });
    await db
      .updateTable('team')
      .set({ parentTeamId: secondId })
      .where('id', '=', firstId)
      .execute();

    expect(await findManagedUserIds(db, loopManagerId)).toEqual(new Set([loopMemberId]));
  });

  it('knows who manages a team', async () => {
    expect(await isTeamManager(db, ids.frontLead ?? -1)).toBe(true);
    expect(await isTeamManager(db, ids.alice ?? -1)).toBe(false);
  });

  it('builds the actor used by the policy from the database', async () => {
    const actor = await loadActor(db, { id: ids.techLead ?? -1, isAdmin: false });

    expect(actor).toEqual({
      id: ids.techLead,
      isAdmin: false,
      isManager: true,
      managedUserIds: idsOf('bob', 'frontLead', 'alice', 'carol'),
      directReportIds: idsOf('bob', 'frontLead'),
    });
  });
});
