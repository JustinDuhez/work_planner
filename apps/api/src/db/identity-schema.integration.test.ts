import { sql, type Kysely } from 'kysely';
import { insertTeam, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import type { Database } from './database';

describe('identity schema', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('gives a new user a standard 7-hour day', async () => {
    const userId = await insertUser(db, { email: 'default.day@example.com' });

    const user = await db
      .selectFrom('appUser')
      .select(['dailyMinutes', 'isAdmin', 'isBlocked', 'archivedAt'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(user).toEqual({ dailyMinutes: 420, isAdmin: false, isBlocked: false, archivedAt: null });
  });

  it('refuses an email that is not stored in lowercase', async () => {
    await expect(insertUser(db, { email: 'Upper.Case@example.com' })).rejects.toThrow(/check/i);
  });

  it('refuses two accounts with the same email', async () => {
    await insertUser(db, { email: 'twice@example.com' });

    await expect(insertUser(db, { email: 'twice@example.com' })).rejects.toThrow(/unique/i);
  });

  it('refuses a working day of zero minutes', async () => {
    await expect(insertUser(db, { email: 'zero@example.com', dailyMinutes: 0 })).rejects.toThrow(
      /check/i,
    );
  });

  it('deletes the sessions of a deleted user', async () => {
    const userId = await insertUser(db, { email: 'cascade@example.com' });
    await db
      .insertInto('session')
      .values({
        tokenHash: 'hash-cascade',
        userId,
        csrfToken: 'csrf',
        lastSeenAt: new Date(),
        expiresAt: new Date(),
      })
      .execute();

    await db.deleteFrom('appUser').where('id', '=', userId).execute();

    const remaining = await db
      .selectFrom('session')
      .select('id')
      .where('userId', '=', userId)
      .execute();
    expect(remaining).toEqual([]);
  });

  it('refuses a team that is its own parent', async () => {
    const teamId = await insertTeam(db, { name: 'Boucle' });

    await expect(
      db.updateTable('team').set({ parentTeamId: teamId }).where('id', '=', teamId).execute(),
    ).rejects.toThrow(/check/i);
  });

  it('refuses the same member twice in a team', async () => {
    const userId = await insertUser(db, { email: 'member.twice@example.com' });
    const teamId = await insertTeam(db, { name: 'Doublon', memberIds: [userId] });

    await expect(db.insertInto('teamMember').values({ teamId, userId }).execute()).rejects.toThrow(
      /duplicate|unique/i,
    );
  });

  it('keeps updated_at current on every identity table', async () => {
    const { rows } = await sql<{ tableName: string }>`
      SELECT event_object_table AS table_name FROM information_schema.triggers
      WHERE trigger_name LIKE '%set_updated_at' ORDER BY event_object_table
    `.execute(db);

    expect(rows.map((row) => row.tableName)).toEqual([
      'app_user',
      'clock_correction',
      'clock_day',
      'clock_period',
      'counter_reset',
      'daily_minutes_change',
      'notification',
      'session',
      'setting',
      'team',
      'team_member',
    ]);
  });
});
