const MILLISECONDS_PER_MINUTE = 60_000;
const HALF_DAY_IN_MILLISECONDS = 12 * 60 * MILLISECONDS_PER_MINUTE;
const MIDNIGHT = '00:00';
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WORK_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DayBounds {
  start: Date;
  nextStart: Date;
}

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterByTimeZone.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatterByTimeZone.set(timeZone, formatter);
  }
  return formatter;
}

function localDateTimeOf(instant: Date, timeZone: string): LocalDateTime {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: valueOf('year'),
    month: valueOf('month'),
    day: valueOf('day'),
    hour: valueOf('hour'),
    minute: valueOf('minute'),
  };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function parseWorkDate(workDate: string): { year: number; month: number; day: number } | null {
  const match = WORK_DATE_PATTERN.exec(workDate);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatUtcDate(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function truncateToMinute(instant: Date): Date {
  return new Date(
    Math.floor(instant.getTime() / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE,
  );
}

export function toWorkDate(instant: Date, timeZone: string): string {
  const { year, month, day } = localDateTimeOf(instant, timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function toLocalTime(instant: Date, timeZone: string): string {
  const { hour, minute } = localDateTimeOf(instant, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

export function addDays(workDate: string, days: number): string {
  const date = parseWorkDate(workDate);
  if (!date) throw new RangeError(`Invalid work date: ${workDate}`);
  return formatUtcDate(new Date(Date.UTC(date.year, date.month - 1, date.day + days)));
}

function offsetInMilliseconds(instant: number, timeZone: string): number {
  const local = localDateTimeOf(new Date(instant), timeZone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return localAsUtc - Math.floor(instant / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
}

/**
 * The instant of a wall-clock time on a given day. Offsets are probed half a day around the
 * wall-clock time so both sides of a clock change are tried: no candidate matches a time skipped
 * in spring (null), two match a time repeated in autumn (the first one wins).
 */
export function localTimeToInstant(
  workDate: string,
  localTime: string,
  timeZone: string,
): Date | null {
  const date = parseWorkDate(workDate);
  const time = LOCAL_TIME_PATTERN.exec(localTime);
  if (!date || !time) return null;
  const wallClockAsUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    Number(time[1]),
    Number(time[2]),
  );
  const candidates = [
    wallClockAsUtc - HALF_DAY_IN_MILLISECONDS,
    wallClockAsUtc + HALF_DAY_IN_MILLISECONDS,
  ]
    .map((probe) => wallClockAsUtc - offsetInMilliseconds(probe, timeZone))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .filter((candidate) => {
      const instant = new Date(candidate);
      return (
        toWorkDate(instant, timeZone) === workDate && toLocalTime(instant, timeZone) === localTime
      );
    })
    .sort((first, second) => first - second);
  const [earliest] = candidates;
  return earliest === undefined ? null : new Date(earliest);
}

export function dayBounds(workDate: string, timeZone: string): DayBounds {
  const start = localTimeToInstant(workDate, MIDNIGHT, timeZone);
  const nextStart = localTimeToInstant(addDays(workDate, 1), MIDNIGHT, timeZone);
  // Midnight exists every day in Europe/Paris (clock changes happen at 2-3 am).
  if (!start || !nextStart) throw new RangeError(`No midnight on ${workDate} in ${timeZone}`);
  return { start, nextStart };
}
