const MINUTES_PER_HOUR = 60;
const MINUS_SIGN = '−';

/** `H:MM`, as on the time-clock mockup; negative for a deficit. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
  const remainder = String(absoluteMinutes % MINUTES_PER_HOUR).padStart(2, '0');
  return `${sign}${hours}:${remainder}`;
}

/** A gap: `+1:30`, `−0:29` (true minus sign, easier to read than a hyphen), `0:00`. */
export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return formatMinutes(0);
  const sign = minutes > 0 ? '+' : MINUS_SIGN;
  return `${sign}${formatMinutes(Math.abs(minutes))}`;
}
