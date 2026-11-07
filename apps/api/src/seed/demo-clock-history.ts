import {
  addDays,
  datesOfIsoWeek,
  isoWeekOf,
  localTimeToInstant,
  toWorkDate,
  type WorkMode,
} from '@work-planner/domain';

const PAST_WEEK_COUNT = 3;
const DAYS_PER_WEEK = 7;
const WORKING_DAYS_PER_WEEK = 5;
const VARIATION_MINUTES = 15;
const TELEWORK_ONE_IN = 5;
const SHORT_DAY_ONE_IN = 11;
const LONG_DAY_ONE_IN = 13;
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const UNCLOSED_EMAIL = 'lea.moreau@example.com';
const RUNNING_EMAIL = 'hugo.laurent@example.com';
const THURSDAY_INDEX = 3;
const DAY_START = '09:00';

export interface DemoClockDay {
  email: string;
  workDate: string;
  workMode: WorkMode;
  periods: { startedAt: Date; endedAt: Date | null }[];
}

/** FNV-1a: a stable pseudo-random number per (email, date), so re-running the seed changes nothing. */
function stableHash(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const character of text) {
    hash = Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME) >>> 0;
  }
  return hash;
}

function shiftedTime(base: string, minutes: number): string {
  const [hours = 0, baseMinutes = 0] = base.split(':').map(Number);
  const total = hours * 60 + baseMinutes + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function instant(workDate: string, localTime: string, timeZone: string): Date {
  const result = localTimeToInstant(workDate, localTime, timeZone);
  if (!result) throw new RangeError(`No ${localTime} on ${workDate}`);
  return result;
}

function typicalDay(email: string, workDate: string, timeZone: string): DemoClockDay {
  const hash = stableHash(`${email}|${workDate}`);
  const variation = (hash % (2 * VARIATION_MINUTES + 1)) - VARIATION_MINUTES;
  const isShortDay = hash % SHORT_DAY_ONE_IN === 0;
  const isLongDay = hash % LONG_DAY_ONE_IN === 0;
  const morningEnd = shiftedTime('12:30', variation);
  const afternoonStart = shiftedTime('13:30', variation);
  const afternoonEnd = shiftedTime(isLongDay ? '19:00' : '17:30', variation);
  const periods = [
    {
      startedAt: instant(workDate, shiftedTime(DAY_START, variation), timeZone),
      endedAt: instant(workDate, morningEnd, timeZone),
    },
  ];
  if (!isShortDay) {
    periods.push({
      startedAt: instant(workDate, afternoonStart, timeZone),
      endedAt: instant(workDate, afternoonEnd, timeZone),
    });
  }
  return {
    email,
    workDate,
    workMode: hash % TELEWORK_ONE_IN === 0 ? 'telework' : 'on_site',
    periods,
  };
}

function pastDaysOf(
  email: string,
  workDates: readonly string[],
  unclosedDate: string,
  timeZone: string,
): DemoClockDay[] {
  return workDates.map((workDate) => {
    const day = typicalDay(email, workDate, timeZone);
    const lastPeriod = day.periods.at(-1);
    // The demo's "non débadgée" day: the afternoon was never stopped.
    if (email === UNCLOSED_EMAIL && workDate === unclosedDate && lastPeriod) {
      lastPeriod.endedAt = null;
    }
    return day;
  });
}

export function buildDemoClockHistory(options: {
  now: Date;
  timeZone: string;
  emails: readonly string[];
}): DemoClockDay[] {
  const today = toWorkDate(options.now, options.timeZone);
  const currentWeekDates = datesOfIsoWeek(isoWeekOf(today)) ?? [];
  const [currentMonday] = currentWeekDates;
  if (currentMonday === undefined) return [];
  const firstMonday = addDays(currentMonday, -PAST_WEEK_COUNT * DAYS_PER_WEEK);
  const unclosedThursday = addDays(currentMonday, THURSDAY_INDEX - DAYS_PER_WEEK);
  const workDates: string[] = [];
  for (let offset = 0; offset < (PAST_WEEK_COUNT + 1) * DAYS_PER_WEEK; offset += 1) {
    const workDate = addDays(firstMonday, offset);
    if (offset % DAYS_PER_WEEK < WORKING_DAYS_PER_WEEK && workDate < today) {
      workDates.push(workDate);
    }
  }
  const history = options.emails.flatMap((email) =>
    pastDaysOf(email, workDates, unclosedThursday, options.timeZone),
  );
  const dayStart = instant(today, DAY_START, options.timeZone);
  const isWorkingDay = currentWeekDates.slice(0, WORKING_DAYS_PER_WEEK).includes(today);
  const hasDayStarted = options.now.getTime() >= dayStart.getTime();
  if (options.emails.includes(RUNNING_EMAIL) && isWorkingDay && hasDayStarted) {
    history.push({
      email: RUNNING_EMAIL,
      workDate: today,
      workMode: 'on_site',
      periods: [{ startedAt: dayStart, endedAt: null }],
    });
  }
  return history;
}
