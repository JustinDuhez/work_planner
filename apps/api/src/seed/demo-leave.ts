import {
  addDays,
  expandWorkableHalfDays,
  findTeleworkShortfalls,
  mondayOf,
  teleworkRuleNote,
  toWorkDate,
  type Half,
  type LeaveStatus,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { findTakenSlots } from '../leave/leave-repository';

const DAYS_PER_WEEK = 7;

interface DemoLeave {
  email: string;
  dayTypeCode: string;
  /** Week offset from the run week (0 = this week) and weekday index (0 = Monday). */
  week: number;
  firstDay: number;
  lastDay: number;
  endHalf?: Half;
  status: LeaveStatus;
  reviewerEmail?: string;
  reviewComment?: string;
}

const DEMO_LEAVE: readonly DemoLeave[] = [
  {
    email: 'lea.moreau@example.com',
    dayTypeCode: 'leave',
    week: 1,
    firstDay: 0,
    lastDay: 2,
    status: 'approved',
    reviewerEmail: 'sophie.dubois@example.com',
  },
  // 3 telework days leave 2 on site: held by the rule, like a real request would be.
  {
    email: 'hugo.laurent@example.com',
    dayTypeCode: 'telework',
    week: 1,
    firstDay: 0,
    lastDay: 2,
    status: 'pending',
  },
  {
    email: 'camille.simon@example.com',
    dayTypeCode: 'training_travel',
    week: 1,
    firstDay: 3,
    lastDay: 3,
    status: 'refused',
    reviewerEmail: 'thomas.petit@example.com',
    reviewComment: 'Formation reportée au trimestre prochain.',
  },
  {
    email: 'emma.lefebvre@example.com',
    dayTypeCode: 'sick',
    week: -1,
    firstDay: 1,
    lastDay: 1,
    status: 'approved',
    reviewerEmail: 'nicolas.michel@example.com',
  },
  {
    email: 'emma.lefebvre@example.com',
    dayTypeCode: 'leave',
    week: 2,
    firstDay: 2,
    lastDay: 4,
    status: 'cancelled',
  },
];

/** Demo requests relative to the run date; a slot already taken (e.g. by real use) skips the request. */
export async function seedDemoLeave(
  db: Kysely<Database>,
  clock: { now: Date; timeZone: string },
): Promise<void> {
  const thisMonday = mondayOf(toWorkDate(clock.now, clock.timeZone));
  for (const demo of DEMO_LEAVE) {
    const weekMonday = addDays(thisMonday, demo.week * DAYS_PER_WEEK);
    const weekSunday = addDays(weekMonday, DAYS_PER_WEEK - 1);
    const range = {
      startDate: addDays(weekMonday, demo.firstDay),
      startHalf: 'am' as const,
      endDate: addDays(weekMonday, demo.lastDay),
      endHalf: demo.endHalf ?? ('pm' as const),
    };
    // Every demo request stays inside one week: that week's holidays cover the range and the telework rule.
    const holidays = new Set(
      (await findPublicHolidays(db, { fromDate: weekMonday, toDate: weekSunday })).map(
        (holiday) => holiday.date,
      ),
    );
    const slots = expandWorkableHalfDays(range, holidays);
    if (slots.length === 0) continue;
    await db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('appUser')
        .select('id')
        .where('email', '=', demo.email)
        .executeTakeFirstOrThrow();
      const dayType = await trx
        .selectFrom('dayType')
        .select(['id', 'isBadgeable'])
        .where('code', '=', demo.dayTypeCode)
        .executeTakeFirstOrThrow();
      // Idempotent: the same request on the same start date is created once.
      const existing = await trx
        .selectFrom('leaveRequest')
        .select('id')
        .where('userId', '=', user.id)
        .where('dayTypeId', '=', dayType.id)
        .where('startDate', '=', range.startDate)
        .executeTakeFirst();
      if (existing) return;
      const isHoldingSlots = demo.status === 'pending' || demo.status === 'approved';
      if (isHoldingSlots) {
        const taken = await trx
          .selectFrom('halfDay')
          .select('id')
          .where('userId', '=', user.id)
          .where(
            'workDate',
            'in',
            slots.map((slot) => slot.date),
          )
          .executeTakeFirst();
        if (taken) return;
      }
      // Earlier seed runs left clocked history: an approved absence on a clocked day would show a
      // phantom surplus, so the request is skipped, like a taken slot.
      if (demo.status === 'approved' && !dayType.isBadgeable) {
        const clocked = await trx
          .selectFrom('clockDay')
          .select('id')
          .where('userId', '=', user.id)
          .where(
            'workDate',
            'in',
            slots.map((slot) => slot.date),
          )
          .executeTakeFirst();
        if (clocked) return;
      }
      const reviewer = demo.reviewerEmail
        ? await trx
            .selectFrom('appUser')
            .select('id')
            .where('email', '=', demo.reviewerEmail)
            .executeTakeFirstOrThrow()
        : undefined;
      // The same rule note a real telework request would get (E6a-D2).
      const ruleNote =
        demo.dayTypeCode === 'telework'
          ? teleworkRuleNote(
              findTeleworkShortfalls({
                requested: slots,
                declared: await findTakenSlots(trx, {
                  userId: user.id,
                  fromDate: weekMonday,
                  toDate: weekSunday,
                }),
                holidayDates: holidays,
              }),
            )
          : null;
      const { id } = await trx
        .insertInto('leaveRequest')
        .values({
          userId: user.id,
          dayTypeId: dayType.id,
          ...range,
          halfDayCount: slots.length,
          status: demo.status,
          ruleNote,
          reviewerId: reviewer?.id ?? null,
          reviewComment: demo.reviewComment ?? null,
          reviewedAt: reviewer ? clock.now : null,
          cancelledAt: demo.status === 'cancelled' ? clock.now : null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (isHoldingSlots) {
        await trx
          .insertInto('halfDay')
          .values(
            slots.map((slot) => ({
              userId: user.id,
              workDate: slot.date,
              half: slot.half,
              dayTypeId: dayType.id,
              leaveRequestId: id,
            })),
          )
          .execute();
      }
    });
  }
}
