import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { buildApp } from '../app';
import type { Database } from '../db/database';
import { logIn, TEST_ORIGIN } from '../test/auth-helpers';
import { insertLeaveRequest, insertPublicHoliday, insertTeam, insertUser } from '../test/fixtures';
import { createTestClock } from '../test/test-clock';
import { createTestConfig } from '../test/test-config';
import { createMigratedTestDb } from '../test/test-database';

// Thursday 12 November 2026, 09:00 Paris.
const NOW = new Date('2026-11-12T08:00:00Z');

interface RequestBody {
  id: number;
  status: string;
  isAutoApproved: boolean;
  ruleNote: string | null;
  halfDayCount: number;
}

describe('creating leave requests', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let managerId: number;
  let teamId: number;
  let memberCount = 0;
  const sessions = new Map<string, { cookie: string; csrfToken: string }>();

  async function post(email: string, payload: object) {
    const session = sessions.get(email) ?? (await logIn(app, email));
    sessions.set(email, session);
    return app.inject({
      method: 'POST',
      url: '/api/v1/leave-requests',
      headers: { cookie: session.cookie, origin: TEST_ORIGIN, 'x-csrf-token': session.csrfToken },
      payload,
    });
  }

  async function newMember(): Promise<{ id: number; email: string }> {
    memberCount += 1;
    const email = `member${memberCount}.leave@example.com`;
    const id = await insertUser(db, { email });
    await db.insertInto('teamMember').values({ teamId, userId: id }).execute();
    return { id, email };
  }

  function leave(overrides: object = {}) {
    return {
      dayTypeCode: 'leave',
      startDate: '2026-11-23',
      startHalf: 'am',
      endDate: '2026-11-25',
      endHalf: 'pm',
      ...overrides,
    };
  }

  beforeAll(async () => {
    db = await createMigratedTestDb();
    managerId = await insertUser(db, { email: 'sophie.leave@example.com' });
    teamId = await insertTeam(db, { name: 'Leave team', managerId });
    await insertUser(db, { email: 'ines.leave@example.com', isAdmin: true });
    await insertPublicHoliday(db, { date: '2026-12-25', label: 'Noël' });
    app = await buildApp({ config: createTestConfig(), db, now: createTestClock(NOW).now });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('records a pending leave with its half-days and tells the approvers', async () => {
    const member = await newMember();

    const response = await post(member.email, leave());

    expect(response.statusCode).toBe(201);
    expect(response.json<RequestBody>()).toMatchObject({
      status: 'pending',
      isAutoApproved: false,
      halfDayCount: 6,
    });
    const notified = await db
      .selectFrom('notification')
      .select('userId')
      .where('type', '=', 'leave_request_received')
      .execute();
    expect(notified.map((row) => row.userId)).toEqual(expect.arrayContaining([managerId]));
  });

  it('approves telework at once while 3 days stay on site', async () => {
    const member = await newMember();

    const response = await post(
      member.email,
      leave({ dayTypeCode: 'telework', startDate: '2026-11-23', endDate: '2026-11-24' }),
    );

    expect(response.json<RequestBody>()).toMatchObject({
      status: 'approved',
      isAutoApproved: true,
      ruleNote: null,
    });
  });

  it('holds telework that would leave fewer than 3 days on site, with the reason', async () => {
    const member = await newMember();

    const response = await post(
      member.email,
      leave({
        dayTypeCode: 'telework',
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        endHalf: 'am',
      }),
    );

    expect(response.json<RequestBody>()).toMatchObject({
      status: 'pending',
      ruleNote: 'Il ne resterait que 2,5 jours sur site la semaine du 23 nov.',
    });
  });

  it('counts the pending requests already in the week for the telework rule', async () => {
    const member = await newMember();
    await insertLeaveRequest(db, {
      userId: member.id,
      dayTypeCode: 'leave',
      startDate: '2026-11-26',
      endDate: '2026-11-27',
      status: 'pending',
    });

    const response = await post(
      member.email,
      leave({ dayTypeCode: 'telework', startDate: '2026-11-23', endDate: '2026-11-23' }),
    );

    expect(response.json<RequestBody>().status).toBe('pending');
  });

  it('skips weekends and public holidays', async () => {
    const member = await newMember();

    // Wednesday 23 to Monday 28 December: 25 is Christmas, 26-27 the weekend.
    const response = await post(
      member.email,
      leave({ startDate: '2026-12-23', endDate: '2026-12-28' }),
    );

    expect(response.json<RequestBody>().halfDayCount).toBe(6);
  });

  it.each([
    [
      'a type that cannot be requested',
      { dayTypeCode: 'on_site' },
      400,
      'LEAVE_TYPE_NOT_REQUESTABLE',
    ],
    ['an unknown type', { dayTypeCode: 'holiday' }, 400, 'LEAVE_TYPE_NOT_REQUESTABLE'],
    [
      'a start in the past',
      { startDate: '2026-11-11', endDate: '2026-11-13' },
      400,
      'LEAVE_DATE_IN_PAST',
    ],
    [
      'an end before the start',
      { startDate: '2026-11-25', endDate: '2026-11-23' },
      400,
      'LEAVE_RANGE_ORDER',
    ],
    [
      'a range over a year',
      { startDate: '2026-11-23', endDate: '2027-11-25' },
      400,
      'LEAVE_RANGE_TOO_LONG',
    ],
    [
      'a weekend only',
      { startDate: '2026-11-21', endDate: '2026-11-22' },
      400,
      'LEAVE_EMPTY_RANGE',
    ],
    [
      'a date that does not exist',
      { startDate: '2026-11-31', endDate: '2026-11-31' },
      400,
      'VALIDATION_ERROR',
    ],
  ])('refuses %s', async (_what, overrides, status, code) => {
    const member = await newMember();

    const response = await post(member.email, leave(overrides));

    expect(response.statusCode).toBe(status);
    expect(response.json<{ code: string }>().code).toBe(code);
  });

  it('needs a reason and a single half-day for an early departure', async () => {
    const member = await newMember();
    const early = {
      dayTypeCode: 'early_departure',
      startDate: '2026-11-23',
      startHalf: 'pm',
      endDate: '2026-11-23',
      endHalf: 'pm',
    };

    const withoutReason = await post(member.email, early);
    const tooLong = await post(member.email, {
      ...early,
      startHalf: 'am',
      reason: 'Rendez-vous médical',
    });
    const accepted = await post(member.email, { ...early, reason: 'Rendez-vous médical' });

    expect(
      withoutReason.json<{ code: string; fieldErrors: Record<string, string> }>(),
    ).toMatchObject({
      code: 'LEAVE_REASON_REQUIRED',
      fieldErrors: { reason: 'Indiquez le motif du départ anticipé.' },
    });
    expect(tooLong.json<{ code: string }>().code).toBe('LEAVE_SINGLE_HALF_DAY');
    expect(accepted.statusCode).toBe(201);
  });

  it('refuses a half-day already declared, naming it', async () => {
    const member = await newMember();
    await post(member.email, leave({ startDate: '2026-11-30', endDate: '2026-11-30' }));

    const response = await post(
      member.email,
      leave({ startDate: '2026-11-30', startHalf: 'pm', endDate: '2026-12-01' }),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string; message: string }>()).toMatchObject({
      code: 'LEAVE_OVERLAP',
      message: 'Le 30 nov. (après-midi) est déjà déclaré.',
    });
  });

  it('frees half-days of a refused or cancelled request', async () => {
    const member = await newMember();
    await insertLeaveRequest(db, {
      userId: member.id,
      dayTypeCode: 'leave',
      startDate: '2026-12-02',
      status: 'refused',
    });

    expect(
      (await post(member.email, leave({ startDate: '2026-12-02', endDate: '2026-12-02' })))
        .statusCode,
    ).toBe(201);
  });

  it('lets only one of two simultaneous requests take the same half-day', async () => {
    const member = await newMember();
    await logIn(app, member.email).then((session) => sessions.set(member.email, session));

    const responses = await Promise.all([
      post(member.email, leave({ startDate: '2026-12-03', endDate: '2026-12-03' })),
      post(
        member.email,
        leave({ dayTypeCode: 'sick', startDate: '2026-12-03', endDate: '2026-12-03' }),
      ),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
  });
});
