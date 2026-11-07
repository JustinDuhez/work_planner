import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertClockDay, insertClockPeriod, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock, type TestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 6 November 2026, 15:30 in Paris (UTC+1).
const NOW = new Date('2026-11-06T14:30:00Z');
const ONE_HOUR_IN_MILLISECONDS = 3_600_000;

interface Session {
  cookie: string;
  csrfToken: string;
}

describe('clocking commands', () => {
  let db: Kysely<Database>;
  let clock: TestClock;
  let app: FastifyInstance;
  let userCount = 0;
  let managedId: number;

  function send(
    session: Session,
    method: 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ) {
    return app.inject({
      method,
      url,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  }

  async function newPerson(): Promise<{ id: number; session: Session }> {
    userCount += 1;
    const email = `clocker${userCount}@example.com`;
    const id = await insertUser(db, { email });
    return { id, session: await logIn(app, email) };
  }

  async function unclosedPeriodOf(userId: number): Promise<number> {
    const dayId = await insertClockDay(db, { userId, workDate: '2026-11-05' });
    return insertClockPeriod(db, {
      clockDayId: dayId,
      startedAt: new Date('2026-11-05T12:00:00Z'),
    });
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    const managerId = await insertUser(db, { email: 'manager.commands@example.com' });
    managedId = await insertUser(db, { email: 'managed.commands@example.com' });
    await insertTeam(db, { name: 'Commands team', managerId, memberIds: [managedId] });
    await insertUser(db, { email: 'admin.commands@example.com', isAdmin: true });
  });

  beforeEach(async () => {
    clock = createTestClock(NOW);
    app = await buildApp({ config: createTestConfig(), db, now: clock.now });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Start and Stop', () => {
    it('starts a period now, on site by default', async () => {
      const { id, session } = await newPerson();

      const response = await send(session, 'POST', '/api/v1/clock-periods', {});

      expect(response.statusCode).toBe(201);
      expect(response.json<unknown>()).toMatchObject({
        startedAt: NOW.toISOString(),
        endedAt: null,
      });
      const day = await db
        .selectFrom('clockDay')
        .select('workMode')
        .where('userId', '=', id)
        .executeTakeFirstOrThrow();
      expect(day.workMode).toBe('on_site');
    });

    it('records the work mode chosen at the first Start', async () => {
      const { id, session } = await newPerson();

      await send(session, 'POST', '/api/v1/clock-periods', { workMode: 'telework' });

      const day = await db
        .selectFrom('clockDay')
        .select('workMode')
        .where('userId', '=', id)
        .executeTakeFirstOrThrow();
      expect(day.workMode).toBe('telework');
    });

    it('refuses a second Start while a period is running', async () => {
      const { session } = await newPerson();
      await send(session, 'POST', '/api/v1/clock-periods', {});

      const response = await send(session, 'POST', '/api/v1/clock-periods', {});

      expect(response.statusCode).toBe(409);
      expect(response.json<{ code: string }>().code).toBe('CLOCK_ALREADY_RUNNING');
    });

    it('lets exactly one of two simultaneous Starts through', async () => {
      const { id, session } = await newPerson();
      // The day row exists beforehand so both transactions race on the period constraints.
      await insertClockDay(db, { userId: id, workDate: '2026-11-06' });

      const responses = await Promise.all([
        send(session, 'POST', '/api/v1/clock-periods', {}),
        send(session, 'POST', '/api/v1/clock-periods', {}),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    });

    it('stops the running period at the server time', async () => {
      const { session } = await newPerson();
      const started = (await send(session, 'POST', '/api/v1/clock-periods', {})).json<{
        id: number;
      }>();
      clock.advanceBy(ONE_HOUR_IN_MILLISECONDS);

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${started.id}`, {
        endedAt: 'now',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ endedAt: string }>().endedAt).toBe('2026-11-06T15:30:00.000Z');
    });
  });

  describe("editing today's periods", () => {
    it('adds a forgotten closed period', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'POST', '/api/v1/clock-periods', {
        startedAt: '09:00',
        endedAt: '12:00',
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<unknown>()).toMatchObject({
        startedAt: '2026-11-06T08:00:00.000Z',
        endedAt: '2026-11-06T11:00:00.000Z',
      });
    });

    it('starts a running period in the past when the person forgot to clock in', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'POST', '/api/v1/clock-periods', { startedAt: '13:30' });

      expect(response.json<unknown>()).toMatchObject({
        startedAt: '2026-11-06T12:30:00.000Z',
        endedAt: null,
      });
    });

    it.each([
      [
        'overlapping another period',
        { startedAt: '11:00', endedAt: '13:00' },
        409,
        'CLOCK_PERIOD_OVERLAP',
      ],
      ['in the future', { startedAt: '16:00' }, 400, 'CLOCK_TIME_IN_FUTURE'],
      [
        'ending before it starts',
        { startedAt: '12:00', endedAt: '11:00' },
        400,
        'CLOCK_END_BEFORE_START',
      ],
    ])('refuses a period %s', async (_description, payload, status, code) => {
      const { session } = await newPerson();
      await send(session, 'POST', '/api/v1/clock-periods', {
        startedAt: '09:00',
        endedAt: '12:00',
      });

      const response = await send(session, 'POST', '/api/v1/clock-periods', payload);

      expect(response.statusCode).toBe(status);
      expect(response.json<{ code: string }>().code).toBe(code);
    });

    it('refuses an end time without a start time, with a field message', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'POST', '/api/v1/clock-periods', { endedAt: '12:00' });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ fieldErrors: unknown }>().fieldErrors).toEqual({
        startedAt: 'Heure de début requise.',
      });
    });

    it('edits the times of a period of today', async () => {
      const { session } = await newPerson();
      const period = (
        await send(session, 'POST', '/api/v1/clock-periods', {
          startedAt: '09:00',
          endedAt: '12:00',
        })
      ).json<{ id: number }>();

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${period.id}`, {
        startedAt: '08:30',
      });

      expect(response.json<unknown>()).toMatchObject({ startedAt: '2026-11-06T07:30:00.000Z' });
    });

    it('deletes a period of today', async () => {
      const { session } = await newPerson();
      const period = (
        await send(session, 'POST', '/api/v1/clock-periods', {
          startedAt: '09:00',
          endedAt: '12:00',
        })
      ).json<{ id: number }>();

      const response = await send(session, 'DELETE', `/api/v1/clock-periods/${period.id}`);

      expect(response.statusCode).toBe(204);
      expect(
        await db.selectFrom('clockPeriod').select('id').where('id', '=', period.id).execute(),
      ).toEqual([]);
    });

    it("changes today's work mode", async () => {
      const { session } = await newPerson();

      const response = await send(session, 'PATCH', '/api/v1/clock-days/2026-11-06', {
        workMode: 'telework',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<unknown>()).toEqual({ date: '2026-11-06', workMode: 'telework' });
    });

    it("refuses to change another day's work mode", async () => {
      const { session } = await newPerson();

      const response = await send(session, 'PATCH', '/api/v1/clock-days/2026-11-05', {
        workMode: 'telework',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('CLOCK_DAY_NOT_EDITABLE');
    });

    it('refuses a time skipped by the spring clock change', async () => {
      await app.close();
      clock = createTestClock(new Date('2026-03-29T10:00:00Z'));
      app = await buildApp({ config: createTestConfig(), db, now: clock.now });
      const { session } = await newPerson();

      const response = await send(session, 'POST', '/api/v1/clock-periods', {
        startedAt: '02:30',
        endedAt: '04:00',
      });

      expect(response.json<{ code: string }>().code).toBe('CLOCK_TIME_INVALID');
    });
  });

  describe('frozen days', () => {
    it('refuses to edit a closed period of a past day', async () => {
      const { id, session } = await newPerson();
      const dayId = await insertClockDay(db, { userId: id, workDate: '2026-11-04' });
      const periodId = await insertClockPeriod(db, {
        clockDayId: dayId,
        startedAt: new Date('2026-11-04T08:00:00Z'),
        endedAt: new Date('2026-11-04T11:00:00Z'),
      });

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '13:00',
      });

      expect(response.statusCode).toBe(403);
    });

    it("refuses to touch someone else's period of today", async () => {
      const owner = await newPerson();
      const period = (await send(owner.session, 'POST', '/api/v1/clock-periods', {})).json<{
        id: number;
      }>();
      const other = await newPerson();

      expect(
        (await send(other.session, 'DELETE', `/api/v1/clock-periods/${period.id}`)).statusCode,
      ).toBe(403);
      expect(
        (
          await send(other.session, 'PATCH', `/api/v1/clock-periods/${period.id}`, {
            endedAt: 'now',
          })
        ).statusCode,
      ).toBe(403);
    });

    it('refuses a period id beyond the database integer range', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'PATCH', '/api/v1/clock-periods/99999999999', {
        endedAt: 'now',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ code: string }>().code).toBe('VALIDATION_ERROR');
    });

    it('refuses to edit a period of a future day', async () => {
      const { id, session } = await newPerson();
      const dayId = await insertClockDay(db, { userId: id, workDate: '2026-11-07' });
      const periodId = await insertClockPeriod(db, {
        clockDayId: dayId,
        startedAt: new Date('2026-11-07T08:00:00Z'),
      });

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '17:00',
      });

      expect(response.statusCode).toBe(403);
    });

    it("refuses a manager editing their managed person's period of today", async () => {
      const dayId = await insertClockDay(db, { userId: managedId, workDate: '2026-11-06' });
      const periodId = await insertClockPeriod(db, {
        clockDayId: dayId,
        startedAt: new Date('2026-11-06T08:00:00Z'),
      });
      const session = await logIn(app, 'manager.commands@example.com');

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: 'now',
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses to delete a period of a past day', async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const response = await send(session, 'DELETE', `/api/v1/clock-periods/${periodId}`);

      expect(response.statusCode).toBe(403);
    });

    it('answers 404 when deleting an unknown period', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'DELETE', '/api/v1/clock-periods/999999');

      expect(response.statusCode).toBe(404);
      expect(response.json<{ code: string }>().code).toBe('CLOCK_PERIOD_NOT_FOUND');
    });

    it('answers 404 for an unknown period', async () => {
      const { session } = await newPerson();

      const response = await send(session, 'PATCH', '/api/v1/clock-periods/999999', {
        endedAt: 'now',
      });

      expect(response.json<{ code: string }>().code).toBe('CLOCK_PERIOD_NOT_FOUND');
    });
  });

  describe('closing an unclosed day', () => {
    it('lets the owner set the real end time once', async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const first = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '17:00',
      });
      const second = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '18:00',
      });

      expect(first.statusCode).toBe(200);
      expect(first.json<{ endedAt: string }>().endedAt).toBe('2026-11-05T16:00:00.000Z');
      expect(second.statusCode).toBe(403);
    });

    it("refuses 'now' as the end of an unclosed past day", async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: 'now',
      });

      expect(response.statusCode).toBe(403);
    });

    it('lets only one of two simultaneous closes through', async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const responses = await Promise.all([
        send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, { endedAt: '17:00' }),
        send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, { endedAt: '18:00' }),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 403]);
      const winner = responses.find((response) => response.statusCode === 200);
      const stored = await db
        .selectFrom('clockPeriod')
        .select('endedAt')
        .where('id', '=', periodId)
        .executeTakeFirstOrThrow();
      expect(stored.endedAt?.toISOString()).toBe(winner?.json<{ endedAt: string }>().endedAt);
    });

    it('refuses to move the start of the unclosed period', async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        startedAt: '12:00',
        endedAt: '17:00',
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses an end before the start of the unclosed period', async () => {
      const { id, session } = await newPerson();
      const periodId = await unclosedPeriodOf(id);

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '12:00',
      });

      expect(response.json<{ code: string }>().code).toBe('CLOCK_END_BEFORE_START');
    });

    it.each([
      ['the manager of the person', 'manager.commands@example.com', '2026-11-03'],
      ['an admin', 'admin.commands@example.com', '2026-11-04'],
    ])('lets %s close it', async (_who, email, workDate) => {
      // One unclosed day per case: the managed person cannot have two rows for the same date.
      const dayId = await insertClockDay(db, { userId: managedId, workDate });
      const periodId = await insertClockPeriod(db, {
        clockDayId: dayId,
        startedAt: new Date(`${workDate}T12:00:00Z`),
      });
      const session = await logIn(app, email);

      const response = await send(session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '17:00',
      });

      expect(response.statusCode).toBe(200);
    });

    it('refuses a colleague outside the scope', async () => {
      const owner = await newPerson();
      const periodId = await unclosedPeriodOf(owner.id);
      const colleague = await newPerson();

      const response = await send(colleague.session, 'PATCH', `/api/v1/clock-periods/${periodId}`, {
        endedAt: '17:00',
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
