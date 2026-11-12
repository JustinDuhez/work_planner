const HALF_DAYS_PER_DAY = 2;
// French writes "1,5 jour" but "2 jours": the plural starts at two.
const PLURAL_FROM_DAYS = 2;
const dayMonthFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayCountFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function formatDayMonth(date: string): string {
  return dayMonthFormat.format(new Date(`${date}T12:00:00Z`));
}

export function formatDayCount(halfDayCount: number): string {
  const days = halfDayCount / HALF_DAYS_PER_DAY;
  return `${dayCountFormat.format(days)} ${days < PLURAL_FROM_DAYS ? 'jour' : 'jours'}`;
}
