import {
  countingStartDate,
  type ClockPeriodTimes,
  type DailyMinutesChange,
} from '@work-planner/domain';
import type { Kysely } from 'kysely';
import { findClockDays } from '../clock/clock-repository';
import type { Database } from '../db/database';
import {
  findApplyingCounterReset,
  findDailyMinutesChanges,
  type CounterProfile,
  type StoredCounterReset,
} from './counter-repository';

export interface CounterFacts {
  countingStart: string;
  lastReset: StoredCounterReset | undefined;
  dailyMinutesChanges: DailyMinutesChange[];
  periodsByDate: Map<string, ClockPeriodTimes[]>;
}

/** A fixed number of queries whatever the history length; the counting itself is pure (D9). */
export async function loadCounterFacts(
  db: Kysely<Database>,
  query: { profile: CounterProfile; today: string },
): Promise<CounterFacts> {
  const [lastReset, dailyMinutesChanges] = await Promise.all([
    findApplyingCounterReset(db, query.profile.id),
    findDailyMinutesChanges(db, query.profile.id),
  ]);
  const countingStart = countingStartDate(query.profile.startDate, lastReset?.resetDate ?? null);
  const storedDays = await findClockDays(db, query.profile.id, countingStart, query.today);
  const periodsByDate = new Map(
    [...storedDays.values()].map((day) => [day.workDate, day.periods] as const),
  );
  return { countingStart, lastReset, dailyMinutesChanges, periodsByDate };
}
