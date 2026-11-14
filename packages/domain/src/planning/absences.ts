import { addDays } from '../clock/time-zone';
import type { Half } from '../contracts/leave';

type Status = 'pending' | 'approved';

export interface AbsenceRun {
  dayTypeCode: string;
  status: Status;
  startDate: string;
  startHalf: Half;
  endDate: string;
  endHalf: Half;
}

function nextSlot(date: string, half: Half): { date: string; half: Half } {
  return half === 'am' ? { date, half: 'pm' } : { date: addDays(date, 1), half: 'am' };
}

/** Phone cards: consecutive half-days of one type and status read as one line. */
export function absenceRuns(
  halfDays: readonly { date: string; half: Half; dayTypeCode: string; status: Status }[],
): AbsenceRun[] {
  const sorted = [...halfDays].sort(
    (first, second) =>
      first.date.localeCompare(second.date) || first.half.localeCompare(second.half),
  );
  const runs: AbsenceRun[] = [];
  for (const halfDay of sorted) {
    const last = runs.at(-1);
    const expected = last ? nextSlot(last.endDate, last.endHalf) : undefined;
    const continues =
      last !== undefined &&
      expected?.date === halfDay.date &&
      expected.half === halfDay.half &&
      last.dayTypeCode === halfDay.dayTypeCode &&
      last.status === halfDay.status;
    if (continues) {
      last.endDate = halfDay.date;
      last.endHalf = halfDay.half;
    } else {
      runs.push({
        dayTypeCode: halfDay.dayTypeCode,
        status: halfDay.status,
        startDate: halfDay.date,
        startHalf: halfDay.half,
        endDate: halfDay.date,
        endHalf: halfDay.half,
      });
    }
  }
  return runs;
}
