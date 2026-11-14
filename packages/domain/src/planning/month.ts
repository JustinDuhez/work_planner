import { addDays } from '../clock/time-zone';
import { isoWeekOf } from '../clock/iso-week';

export interface MonthBounds {
  startDate: string;
  endDate: string;
}

/** `yearMonth` is a validated `YYYY-MM`. */
export function monthBounds(yearMonth: string): MonthBounds {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const nextMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return { startDate: `${yearMonth}-01`, endDate: addDays(`${nextMonth}-01`, -1) };
}

/** Column groups of the month view: every ISO week the month touches, cut to the month. */
export function monthWeeks(
  bounds: MonthBounds,
): { isoWeek: string; weekNumber: number; dates: string[] }[] {
  const weeks: { isoWeek: string; weekNumber: number; dates: string[] }[] = [];
  for (let date = bounds.startDate; date <= bounds.endDate; date = addDays(date, 1)) {
    const isoWeek = isoWeekOf(date);
    const last = weeks.at(-1);
    if (last?.isoWeek === isoWeek) last.dates.push(date);
    else weeks.push({ isoWeek, weekNumber: Number(isoWeek.slice(6)), dates: [date] });
  }
  return weeks;
}
