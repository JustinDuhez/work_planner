const DURATION_PATTERN = /^(\d{1,2})(?::([0-5]\d))?$/;
const MINUTES_PER_HOUR = 60;
const MAX_DAILY_MINUTES = 1440;

/** A daily time typed as `H:MM` or whole hours; null when it is not a valid 0:01–24:00 duration. */
export function parseDuration(text: string): number | null {
  const match = DURATION_PATTERN.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2] ?? 0);
  return minutes >= 1 && minutes <= MAX_DAILY_MINUTES ? minutes : null;
}
