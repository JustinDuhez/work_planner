import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertUser } from '../test/fixtures';
import { createTestClock, type TestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Friday 6 November 2026 in Paris (winter time, UTC+1).
const LATE_NIGHT = new Date('2026-11-06T22:59:10Z'); // 23:59:10
const MORNING = new Date('2026-11-06T08:00:05Z'); // 09:00:05
const HALF_PAST_NINE = new Date('2026-11-06T08:30:00Z');
const WEEK = '2026-W45';
const FRIDAY = '2026-11-06';
const SECONDS_IN_MILLISECONDS = 1000;

interface Session {
  cookie: string;
  csrfToken: string;
}

describe('clocking at the edges of a minute', () => {
  let db: Kysely<Database>;
  let clock: TestClock;
  let app: FastifyInstance;
  let userCount = 0;

  function send(session: Session, method: 'POST' | 'PATCH', url: string, payload: object) {
    return app.inject({
      method,
      url,
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload: payload as Record<string, unknown>,
    });
  }

  async function newPerson(): Promise<{ id: number; session: Session }> {
    userCount += 1;
    const email = `edge${userCount}@example.com`;
    const id = await insertUser(db, { email });
    return { id, session: await logIn(app, email) };
  }

  async function fridayOf(userId: number, session: Session) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${userId}/clock-weeks/${WEEK}`,
      headers: { cookie: session.cookie },
    });
    const body = response.json<{
      counters: { globalGapMinutes: number };
      days: { date: string; periods: unknown[] }[];
    }>();
    const day = body.days.find((candidate) => candidate.date === FRIDAY);
    return { periods: day?.periods ?? [], gap: body.counters.globalGapMinutes };
  }

  function moveTo(instant: Date) {
    clock.advanceBy(instant.getTime() - clock.now().getTime());
  }

  async function startAt(now: Date, session: Session) {
    moveTo(now);
    return send(session, 'POST', '/api/v1/clock-periods', {});
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
  });

  beforeEach(async () => {
    clock = createTestClock(MORNING);
    app = await buildApp({ config: createTestConfig(), db, now: clock.now });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('refuses to start in the last minute of the day', async () => {
    moveTo(LATE_NIGHT); // log in late too: a session does not outlive the jump
    const { session } = await newPerson();

    const response = await startAt(LATE_NIGHT, session);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string; message: string }>()).toMatchObject({
      code: 'CLOCK_START_TOO_LATE',
      message: 'Il est trop tard pour démarrer : la journée se termine à minuit.',
    });
  });

  it('drops the period when Stop comes in the minute of the Start', async () => {
    const { id, session } = await newPerson();
    const before = await fridayOf(id, session);
    const started = (await startAt(MORNING, session)).json<{ id: number }>();
    clock.advanceBy(35 * SECONDS_IN_MILLISECONDS);

    const response = await send(session, 'PATCH', `/api/v1/clock-periods/${started.id}`, {
      endedAt: 'now',
    });

    expect(response.statusCode).toBe(204);
    const after = await fridayOf(id, session);
    expect(after.periods).toEqual([]);
    expect(after.gap).toBe(before.gap);
  });

  it('keeps the period when Stop comes in a later minute', async () => {
    const { session } = await newPerson();
    const started = (await startAt(MORNING, session)).json<{ id: number }>();
    clock.advanceBy(55 * SECONDS_IN_MILLISECONDS);

    const response = await send(session, 'PATCH', `/api/v1/clock-periods/${started.id}`, {
      endedAt: 'now',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ endedAt: string }>().endedAt).toBe('2026-11-06T08:01:00.000Z');
  });

  it('still refuses a typed end equal to the start', async () => {
    const { session } = await newPerson();
    const started = (await startAt(MORNING, session)).json<{ id: number }>();
    moveTo(HALF_PAST_NINE);

    const response = await send(session, 'PATCH', `/api/v1/clock-periods/${started.id}`, {
      endedAt: '09:00',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('CLOCK_END_BEFORE_START');
  });
});
