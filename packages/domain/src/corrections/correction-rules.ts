import { dayBounds, localTimeToInstant } from '../clock/time-zone';
import {
  findDayPeriodViolation,
  type ClockPeriodTimes,
  type ClockViolation,
} from '../clock/worked-minutes';
import type { ClockCorrectionStatus } from '../contracts/correction-status';

export type CorrectionViolation = ClockViolation | 'CLOCK_TIME_INVALID';

export interface CorrectionPeriodInput {
  startedAt: string;
  endedAt: string;
}

export interface CorrectionPeriodProblem {
  violation: CorrectionViolation;
  periodIndex: number;
  field: 'startedAt' | 'endedAt';
}

export type CorrectionPeriodsResult =
  | { isValid: true; periods: ClockPeriodTimes[] }
  | { isValid: false; problem: CorrectionPeriodProblem };

export interface CorrectionStatusRecord {
  id: number;
  workDate: string;
  status: ClockCorrectionStatus;
  createdAt: Date;
}

export interface LatestCorrection {
  id: number;
  status: ClockCorrectionStatus;
}

function invalid(
  violation: CorrectionViolation,
  periodIndex: number,
  field: CorrectionPeriodProblem['field'],
): CorrectionPeriodsResult {
  return { isValid: false, problem: { violation, periodIndex, field } };
}

/** The index (as sent) of the later period of the first overlap, so the error lands on its start. */
function firstOverlapIndex(periods: readonly ClockPeriodTimes[]): number | null {
  const byStart = periods
    .map((period, index) => ({ period, index }))
    .sort((first, second) => first.period.startedAt.getTime() - second.period.startedAt.getTime());
  for (let position = 1; position < byStart.length; position += 1) {
    const previous = byStart[position - 1];
    const current = byStart[position];
    const previousEnd = previous?.period.endedAt;
    if (current && previousEnd && previousEnd.getTime() > current.period.startedAt.getTime()) {
      return current.index;
    }
  }
  return null;
}

/** A corrected day: closed periods only, each inside the day and not in the future, no overlap. */
export function correctionPeriodsOf(
  workDate: string,
  inputs: readonly CorrectionPeriodInput[],
  context: { timeZone: string; now: Date },
): CorrectionPeriodsResult {
  const bounds = dayBounds(workDate, context.timeZone);
  const periods: ClockPeriodTimes[] = [];
  for (const [index, input] of inputs.entries()) {
    const startedAt = localTimeToInstant(workDate, input.startedAt, context.timeZone);
    if (!startedAt) return invalid('CLOCK_TIME_INVALID', index, 'startedAt');
    const endedAt = localTimeToInstant(workDate, input.endedAt, context.timeZone);
    if (!endedAt) return invalid('CLOCK_TIME_INVALID', index, 'endedAt');
    // A single closed period can only fail on its end (before the start, or after now).
    const violation = findDayPeriodViolation([{ startedAt, endedAt }], bounds, context.now);
    if (violation) return invalid(violation, index, 'endedAt');
    periods.push({ startedAt, endedAt });
  }
  const overlapIndex = firstOverlapIndex(periods);
  if (overlapIndex !== null) return invalid('CLOCK_PERIOD_OVERLAP', overlapIndex, 'startedAt');
  return { isValid: true, periods };
}

function isMoreRecent(candidate: CorrectionStatusRecord, current: CorrectionStatusRecord): boolean {
  const timeDifference = candidate.createdAt.getTime() - current.createdAt.getTime();
  return timeDifference > 0 || (timeDifference === 0 && candidate.id > current.id);
}

/** A superseded correction never decides a day: the correction that replaced it does. */
export function latestCorrectionByDate(
  corrections: readonly CorrectionStatusRecord[],
): Map<string, LatestCorrection> {
  const latest = new Map<string, CorrectionStatusRecord>();
  for (const correction of corrections) {
    if (correction.status === 'superseded') continue;
    const current = latest.get(correction.workDate);
    if (!current || isMoreRecent(correction, current)) latest.set(correction.workDate, correction);
  }
  return new Map([...latest].map(([date, { id, status }]) => [date, { id, status }]));
}

/** E5-D5: an open disagreement on a day that still counts (a reset passes over older days). */
export function hasOpenRefusal(
  latestByDate: ReadonlyMap<string, LatestCorrection>,
  countingStart: string,
): boolean {
  return [...latestByDate].some(
    ([workDate, correction]) => workDate >= countingStart && correction.status === 'refused',
  );
}
