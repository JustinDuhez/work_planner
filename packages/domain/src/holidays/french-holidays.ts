import { addDays } from '../clock/time-zone';
import type { PublicHoliday } from '../contracts/holidays';

const EASTER_MONDAY_OFFSET_DAYS = 1;
const ASCENSION_OFFSET_DAYS = 39;
const WHIT_MONDAY_OFFSET_DAYS = 50;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Anonymous Gregorian algorithm (Meeus / Jones / Butcher): exact for every Gregorian year. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${twoDigits(month)}-${twoDigits(day)}`;
}

/** The 11 French public holidays (Code du travail L3133-1), one per date, in date order. */
export function frenchPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  // Definition order decides which label survives when two holidays share a date (2008: Ascension = 1 May).
  const candidates: PublicHoliday[] = [
    { date: `${year}-01-01`, label: "Jour de l'an" },
    { date: addDays(easter, EASTER_MONDAY_OFFSET_DAYS), label: 'Lundi de Pâques' },
    { date: `${year}-05-01`, label: 'Fête du Travail' },
    { date: `${year}-05-08`, label: 'Victoire 1945' },
    { date: addDays(easter, ASCENSION_OFFSET_DAYS), label: 'Ascension' },
    { date: addDays(easter, WHIT_MONDAY_OFFSET_DAYS), label: 'Lundi de Pentecôte' },
    { date: `${year}-07-14`, label: 'Fête nationale' },
    { date: `${year}-08-15`, label: 'Assomption' },
    { date: `${year}-11-01`, label: 'Toussaint' },
    { date: `${year}-11-11`, label: 'Armistice 1918' },
    { date: `${year}-12-25`, label: 'Noël' },
  ];
  const byDate = new Map<string, PublicHoliday>();
  for (const holiday of candidates) {
    if (!byDate.has(holiday.date)) byDate.set(holiday.date, holiday);
  }
  return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
}
