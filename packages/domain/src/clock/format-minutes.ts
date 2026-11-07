const MINUTES_PER_HOUR = 60;

/** `H:MM`, as on the time-clock mockup; negative for a deficit. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
  const remainder = String(absoluteMinutes % MINUTES_PER_HOUR).padStart(2, '0');
  return `${sign}${hours}:${remainder}`;
}
