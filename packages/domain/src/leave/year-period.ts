import { addDays } from '../clock/time-zone';

export interface YearPeriod {
  startDate: string;
  endDate: string;
}

const MONTHS_PER_YEAR = 12;

/** E6b: period Y runs from Y-MM-DD to the day before (Y+1)-MM-DD (`year_start` = MM-DD, E2b). */
export function yearPeriodOf(startYear: number, yearStart: string): YearPeriod {
  return {
    startDate: `${startYear}-${yearStart}`,
    endDate: addDays(`${startYear + 1}-${yearStart}`, -1),
  };
}

export function periodStartYearContaining(date: string, yearStart: string): number {
  const year = Number(date.slice(0, 4));
  return date >= `${year}-${yearStart}` ? year : year - 1;
}

/** Every month the period touches: 12 with a start on the 1st, 13 otherwise. */
export function monthsOfPeriod(period: YearPeriod): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let year = Number(period.startDate.slice(0, 4));
  let month = Number(period.startDate.slice(5, 7));
  const lastKey = period.endDate.slice(0, 7);
  for (;;) {
    months.push({ year, month });
    if (`${year}-${String(month).padStart(2, '0')}` === lastKey) return months;
    month += 1;
    if (month > MONTHS_PER_YEAR) {
      month = 1;
      year += 1;
    }
  }
}
