import type { Kysely } from 'kysely';
import { insertClockCorrection, insertNotification, insertUser } from '../test/fixtures';
import { createMigratedTestDb } from '../test/test-database';
import type { Database } from './database';

describe('corrections schema', () => {
  let db: Kysely<Database>;
  let ownerId: number;
  let authorId: number;

  beforeAll(async () => {
    db = await createMigratedTestDb();
    ownerId = await insertUser(db, { email: 'owner.schema@example.com' });
    authorId = await insertUser(db, { email: 'author.schema@example.com' });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('stores the before and after snapshots as JSON and reads them back', async () => {
    const id = await insertClockCorrection(db, {
      userId: ownerId,
      authorId,
      workDate: '2026-11-02',
      beforePeriods: [{ startedAt: '2026-11-02T08:00:00.000Z', endedAt: null }],
      afterPeriods: [
        { startedAt: '2026-11-02T08:00:00.000Z', endedAt: '2026-11-02T16:00:00.000Z' },
      ],
    });

    const row = await db
      .selectFrom('clockCorrection')
      .select(['beforePeriods', 'afterPeriods'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row.beforePeriods).toEqual([{ startedAt: '2026-11-02T08:00:00.000Z', endedAt: null }]);
    expect(row.afterPeriods[0]?.endedAt).toBe('2026-11-02T16:00:00.000Z');
  });

  it('refuses a second pending correction of the same day', async () => {
    await insertClockCorrection(db, { userId: ownerId, authorId, workDate: '2026-11-03' });

    await expect(
      insertClockCorrection(db, { userId: ownerId, authorId, workDate: '2026-11-03' }),
    ).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('accepts several answered corrections of the same day', async () => {
    const respondedAt = new Date('2026-11-05T09:00:00Z');
    await insertClockCorrection(db, {
      userId: ownerId,
      authorId,
      workDate: '2026-11-04',
      status: 'refused',
      respondedAt,
    });

    await expect(
      insertClockCorrection(db, {
        userId: ownerId,
        authorId,
        workDate: '2026-11-04',
        status: 'accepted',
        respondedAt,
      }),
    ).resolves.toEqual(expect.any(Number));
  });

  it.each([
    [
      'an answered correction without an answer time',
      { status: 'accepted' as const, respondedAt: null },
    ],
    [
      'a pending correction with an answer time',
      { status: 'pending' as const, respondedAt: new Date() },
    ],
  ])('refuses %s', async (_description, values) => {
    await expect(
      insertClockCorrection(db, { userId: ownerId, authorId, workDate: '2026-11-06', ...values }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a comment longer than 500 characters', async () => {
    await expect(
      insertClockCorrection(db, {
        userId: ownerId,
        authorId,
        workDate: '2026-11-07',
        comment: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('stores a notification payload and leaves it unread', async () => {
    const id = await insertNotification(db, {
      userId: ownerId,
      type: 'clock_correction_received',
      payload: { correctionId: 1, ownerId, workDate: '2026-11-02', actorName: 'Sophie Dubois' },
    });

    const row = await db
      .selectFrom('notification')
      .select(['payload', 'readAt'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      payload: { correctionId: 1, ownerId, workDate: '2026-11-02', actorName: 'Sophie Dubois' },
      readAt: null,
    });
  });

  it('refuses an unknown notification type', async () => {
    await expect(
      insertNotification(db, {
        userId: ownerId,
        type: 'leave_approved' as 'clock_correction_received',
        payload: { correctionId: 1, ownerId, workDate: '2026-11-02', actorName: 'X' },
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
