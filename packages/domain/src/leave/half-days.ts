import { datesOfIsoWeek, isoWeekOf } from '../clock/iso-week';
import { addDays } from '../clock/time-zone';
import type { Half } from '../contracts/leave';
import { isWeekendDate } from '../counters/counting';

export interface LeaveRange {
  startDate: string;
  startHalf: Half;
  endDate: string;
  endHalf: Half;
}

export interface HalfDaySlot {
  date: string;
  half: Half;
}

const HALF_ORDER: Record<Half, number> = { am: 0, pm: 1 };

export function slotKey(slot: HalfDaySlot): string {
  return `${slot.date}:${slot.half}`;
}

export function isRangeOrdered(range: LeaveRange): boolean {
  if (range.startDate !== range.endDate) return range.startDate < range.endDate;
  return HALF_ORDER[range.startHalf] <= HALF_ORDER[range.endHalf];
}

/** Every half-day a request really takes: weekends and public holidays are never declared. */
export function expandWorkableHalfDays(
  range: LeaveRange,
  holidayDates: ReadonlySet<string>,
): HalfDaySlot[] {
  const slots: HalfDaySlot[] = [];
  for (let date = range.startDate; date <= range.endDate; date = addDays(date, 1)) {
    if (isWeekendDate(date) || holidayDates.has(date)) continue;
    for (const half of ['am', 'pm'] as const) {
      const isBeforeStart =
        date === range.startDate && HALF_ORDER[half] < HALF_ORDER[range.startHalf];
      const isAfterEnd = date === range.endDate && HALF_ORDER[half] > HALF_ORDER[range.endHalf];
      if (!isBeforeStart && !isAfterEnd) slots.push({ date, half });
    }
  }
  return slots;
}

export function mondayOf(date: string): string {
  const [monday] = datesOfIsoWeek(isoWeekOf(date)) ?? [];
  if (monday === undefined) throw new Error(`No ISO week for ${date}`);
  return monday;
}
