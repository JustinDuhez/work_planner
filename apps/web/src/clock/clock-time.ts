import { addDays, datesOfIsoWeek, isoWeekOf, toWorkDate } from '@work-planner/domain';

/** The company's days are Paris days for everyone, wherever the browser is (same as the API). */
export const APP_TIME_ZONE = 'Europe/Paris';
const DAYS_PER_WEEK = 7;

const dayMonthFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const yearFormat = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });

const longDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const parisDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
});
const parisTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
});

// Noon UTC: a calendar date never shifts to the neighboring day whatever the format time zone.
function dateAtNoon(workDate: string): Date {
  return new Date(`${workDate}T12:00:00Z`);
}

function mondayOf(isoWeek: string): string {
  const [monday] = datesOfIsoWeek(isoWeek) ?? [];
  if (monday === undefined) throw new RangeError(`Invalid ISO week: ${isoWeek}`);
  return monday;
}

export function currentIsoWeek(now: Date): string {
  return isoWeekOf(toWorkDate(now, APP_TIME_ZONE));
}

export function shiftIsoWeek(isoWeek: string, weeks: number): string {
  return isoWeekOf(addDays(mondayOf(isoWeek), weeks * DAYS_PER_WEEK));
}

export function weekNumberLabel(isoWeek: string): string {
  return `S${Number(isoWeek.slice(-2))}`;
}

export function weekRangeLabel(isoWeek: string): string {
  const monday = mondayOf(isoWeek);
  const sunday = addDays(monday, DAYS_PER_WEEK - 1);
  const mondayDay = dateAtNoon(monday).getUTCDate();
  return `${mondayDay} – ${dayMonthFormat.format(dateAtNoon(sunday))} ${yearFormat.format(dateAtNoon(sunday))}`;
}

export function dayLabel(date: string): { weekday: string; dayOfMonth: string } {
  const weekday = weekdayFormat
    .format(dateAtNoon(date))
    .replace('.', '')
    .toLocaleUpperCase('fr-FR');
  return { weekday, dayOfMonth: String(dateAtNoon(date).getUTCDate()) };
}

export function clockWeekPath(userId: number | undefined, isoWeek: string): string {
  const query = `?semaine=${isoWeek}`;
  return userId === undefined ? `/${query}` : `/pointage/${userId}${query}`;
}

export function formatLongDate(date: string): string {
  return longDateFormat.format(dateAtNoon(date));
}

export function formatDateTime(instant: string): string {
  const date = new Date(instant);
  return `${parisDateFormat.format(date)} à ${parisTimeFormat.format(date)}`;
}
