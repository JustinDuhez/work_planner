import { addDays } from './time-zone';

const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;
const DAYS_PER_WEEK = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const THURSDAY_INDEX = 3;
const MAX_YEAR = 9999;
// January 4 is always in ISO week 1.
const ISO_WEEK_ANCHOR_DAY = 4;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function mondayIndexOf(date: Date): number {
  return (date.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

function utcDateOf(workDate: string): Date {
  return new Date(`${workDate}T00:00:00Z`);
}

function firstMondayOfIsoYear(year: number): number {
  const anchor = new Date(Date.UTC(year, 0, ISO_WEEK_ANCHOR_DAY));
  return anchor.getTime() - mondayIndexOf(anchor) * MILLISECONDS_PER_DAY;
}

export function isoWeekOf(workDate: string): string {
  const date = utcDateOf(workDate);
  // The ISO year of a week is the year of its Thursday.
  const thursday = new Date(
    date.getTime() + (THURSDAY_INDEX - mondayIndexOf(date)) * MILLISECONDS_PER_DAY,
  );
  const isoYear = thursday.getUTCFullYear();
  const weekNumber =
    1 +
    Math.floor(
      (thursday.getTime() - firstMondayOfIsoYear(isoYear)) / (DAYS_PER_WEEK * MILLISECONDS_PER_DAY),
    );
  return `${pad(isoYear, 4)}-W${pad(weekNumber)}`;
}

export function datesOfIsoWeek(isoWeek: string): string[] | null {
  const match = ISO_WEEK_PATTERN.exec(isoWeek);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  const monday = new Date(
    firstMondayOfIsoYear(year) + (weekNumber - 1) * DAYS_PER_WEEK * MILLISECONDS_PER_DAY,
  );
  const sunday = new Date(monday.getTime() + (DAYS_PER_WEEK - 1) * MILLISECONDS_PER_DAY);
  // Beyond four digits toISOString() adds a sign and work dates stop parsing.
  if (sunday.getUTCFullYear() > MAX_YEAR) return null;
  const mondayDate = monday.toISOString().slice(0, 10);
  const dates = Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addDays(mondayDate, offset));
  // Week 0, or week 53 of a 52-week year, lands in another ISO week: refuse it.
  return weekNumber >= 1 && isoWeekOf(mondayDate) === isoWeek ? dates : null;
}
