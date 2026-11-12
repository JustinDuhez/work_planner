import { addDays } from '../clock/time-zone';
import { formatDayCount, formatDayMonth } from './french-format';
import { expandWorkableHalfDays, mondayOf, slotKey, type HalfDaySlot } from './half-days';

/** CDC: telework is free while at least 3 days (6 half-days) of the week stay on site. */
export const MIN_ON_SITE_HALF_DAYS_FOR_FREE_TELEWORK = 6;
const SUNDAY_OFFSET_DAYS = 6;

export interface TeleworkShortfall {
  weekMonday: string;
  remainingOnSiteHalfDays: number;
}

/**
 * E6a-D2: per ISO week the request touches, the workable half-days left after every pending or
 * approved declaration and the request itself.
 */
export function findTeleworkShortfalls(input: {
  requested: readonly HalfDaySlot[];
  declared: readonly HalfDaySlot[];
  holidayDates: ReadonlySet<string>;
}): TeleworkShortfall[] {
  const weekMondays = [...new Set(input.requested.map((slot) => mondayOf(slot.date)))].sort();
  const shortfalls: TeleworkShortfall[] = [];
  for (const weekMonday of weekMondays) {
    const workable = expandWorkableHalfDays(
      {
        startDate: weekMonday,
        startHalf: 'am',
        endDate: addDays(weekMonday, SUNDAY_OFFSET_DAYS),
        endHalf: 'pm',
      },
      input.holidayDates,
    );
    const workableKeys = new Set(workable.map(slotKey));
    const takenKeys = new Set(
      [...input.declared, ...input.requested].map(slotKey).filter((key) => workableKeys.has(key)),
    );
    const remainingOnSiteHalfDays = workableKeys.size - takenKeys.size;
    if (remainingOnSiteHalfDays < MIN_ON_SITE_HALF_DAYS_FOR_FREE_TELEWORK) {
      shortfalls.push({ weekMonday, remainingOnSiteHalfDays });
    }
  }
  return shortfalls;
}

/** The explicit message the approver reads (F6.3). */
export function teleworkRuleNote(shortfalls: readonly TeleworkShortfall[]): string | null {
  if (shortfalls.length === 0) return null;
  return shortfalls
    .map(({ weekMonday, remainingOnSiteHalfDays }) => {
      const week = `la semaine du ${formatDayMonth(weekMonday)}`;
      const sentence =
        remainingOnSiteHalfDays === 0
          ? `Il ne resterait aucun jour sur site ${week}`
          : `Il ne resterait que ${formatDayCount(remainingOnSiteHalfDays)} sur site ${week}`;
      // An abbreviated month ("nov.") already ends with a full stop; "mai" does not.
      return sentence.endsWith('.') ? sentence : `${sentence}.`;
    })
    .join(' ');
}
