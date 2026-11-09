import { addDays, datesOfIsoWeek, dayBounds, isoWeekOf, toWorkDate } from '@work-planner/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db/database';
import { toSnapshot } from '../corrections/correction-repository';

const DAYS_PER_WEEK = 7;
const MONDAY_INDEX = 0;
const TUESDAY_INDEX = 1;
const MINUTES_IN_MILLISECONDS = 60_000;
const LEA_EXTENSION_MINUTES = 30;
const CAMILLE_SHORTENING_MINUTES = 15;

interface DemoPeriod {
  startedAt: Date;
  endedAt: Date | null;
}

interface DemoDay {
  workDate: string;
  timeZone: string;
}

interface DemoCorrection {
  ownerEmail: string;
  authorEmail: string;
  dayIndex: number;
  comment: string;
  // Changes the stored day into the corrected one; null when this day cannot be corrected safely.
  correct: (periods: DemoPeriod[], day: DemoDay) => DemoPeriod[] | null;
  refusal: string | null;
}

const DEMO_CORRECTIONS: readonly DemoCorrection[] = [
  {
    ownerEmail: 'lea.moreau@example.com',
    authorEmail: 'sophie.dubois@example.com',
    dayIndex: TUESDAY_INDEX,
    comment: 'Réunion client oubliée',
    // Production data may differ from the demo history: an open last period cannot be extended,
    // nor one that would then reach the next day (a day runs until 23:59).
    correct: (periods, day) => {
      const last = periods.at(-1);
      if (!last?.endedAt) return null;
      const endedAt = new Date(
        last.endedAt.getTime() + LEA_EXTENSION_MINUTES * MINUTES_IN_MILLISECONDS,
      );
      if (endedAt >= dayBounds(day.workDate, day.timeZone).nextStart) return null;
      return [...periods.slice(0, -1), { ...last, endedAt }];
    },
    refusal: null,
  },
  {
    ownerEmail: 'camille.simon@example.com',
    authorEmail: 'thomas.petit@example.com',
    dayIndex: MONDAY_INDEX,
    comment: 'Arrivée badgée en avance par erreur',
    // A first period of 15 minutes or less would be inverted by the shift (or nothing to shift).
    correct: (periods) => {
      const [first, ...others] = periods;
      if (!first?.endedAt) return null;
      const startedAt = new Date(
        first.startedAt.getTime() + CAMILLE_SHORTENING_MINUTES * MINUTES_IN_MILLISECONDS,
      );
      if (startedAt >= first.endedAt) return null;
      return [{ ...first, startedAt }, ...others];
    },
    refusal: "J'étais en déplacement ce jour-là.",
  },
];

async function userOf(db: Kysely<Database>, email: string): Promise<{ id: number; name: string }> {
  const user = await db
    .selectFrom('appUser')
    .select(['id', 'firstName', 'lastName'])
    .where('email', '=', email)
    .executeTakeFirstOrThrow();
  return { id: user.id, name: `${user.firstName} ${user.lastName}` };
}

async function seedCorrectionIfMissing(
  db: Kysely<Database>,
  correction: DemoCorrection,
  context: { workDate: string; timeZone: string; now: Date },
): Promise<void> {
  const owner = await userOf(db, correction.ownerEmail);
  const existing = await db
    .selectFrom('clockCorrection')
    .select('id')
    .where('userId', '=', owner.id)
    .executeTakeFirst();
  if (existing) return;
  const day = await db
    .selectFrom('clockDay')
    .select(['id', 'workMode'])
    .where('userId', '=', owner.id)
    .where('workDate', '=', context.workDate)
    .executeTakeFirst();
  // No demo day to correct (history missing for that person): nothing to show.
  if (!day) return;
  const author = await userOf(db, correction.authorEmail);
  const before = await db
    .selectFrom('clockPeriod')
    .select(['startedAt', 'endedAt'])
    .where('clockDayId', '=', day.id)
    .orderBy('startedAt')
    .execute();
  const after = correction.correct(before, context);
  if (!after) return;
  const isRefused = correction.refusal !== null;
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('clockPeriod').where('clockDayId', '=', day.id).execute();
    await trx
      .insertInto('clockPeriod')
      .values(after.map((period) => ({ clockDayId: day.id, ...period })))
      .execute();
    const { id: correctionId } = await trx
      .insertInto('clockCorrection')
      .values({
        userId: owner.id,
        workDate: context.workDate,
        authorId: author.id,
        beforeWorkMode: day.workMode,
        afterWorkMode: day.workMode,
        beforePeriods: toSnapshot(before),
        afterPeriods: toSnapshot(after),
        comment: correction.comment,
        status: isRefused ? 'refused' : 'pending',
        responseComment: correction.refusal,
        respondedAt: isRefused ? context.now : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const payload = { correctionId, ownerId: owner.id, workDate: context.workDate };
    await trx
      .insertInto('notification')
      .values({
        userId: owner.id,
        type: 'clock_correction_received',
        payload: JSON.stringify({ ...payload, actorName: author.name }),
        // A refused correction has been seen and answered by its owner.
        readAt: isRefused ? context.now : null,
      })
      .execute();
    if (isRefused) {
      await trx
        .insertInto('notification')
        .values({
          userId: author.id,
          type: 'clock_correction_answered',
          payload: JSON.stringify({ ...payload, actorName: owner.name, status: 'refused' }),
        })
        .execute();
    }
  });
}

export async function seedDemoCorrections(
  db: Kysely<Database>,
  clock: { now: Date; timeZone: string },
): Promise<void> {
  const [currentMonday] = datesOfIsoWeek(isoWeekOf(toWorkDate(clock.now, clock.timeZone))) ?? [];
  if (currentMonday === undefined)
    throw new RangeError(`No ISO week for ${clock.now.toISOString()}`);
  const lastMonday = addDays(currentMonday, -DAYS_PER_WEEK);
  for (const correction of DEMO_CORRECTIONS) {
    await seedCorrectionIfMissing(db, correction, {
      workDate: addDays(lastMonday, correction.dayIndex),
      timeZone: clock.timeZone,
      now: clock.now,
    });
  }
}
