import { z } from 'zod';

export const DEFAULT_YEAR_START = '07-01';

const YEAR_START_PATTERN = /^(\d{2})-(\d{2})$/;
// A non-leap year: the start must exist every year, so 29 February is refused.
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isValidYearStart(value: string): boolean {
  const match = YEAR_START_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const daysInMonth = DAYS_IN_MONTH[month - 1];
  return daysInMonth !== undefined && day >= 1 && day <= daysInMonth;
}

export const yearStartSchema = z
  .string()
  .refine(isValidYearStart, { message: 'Choisissez un jour qui existe chaque année.' });
