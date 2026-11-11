import { z } from 'zod';
import { MAX_NAME_LENGTH } from './session';
import { workDateSchema } from './work-date';

export const HOLIDAY_YEAR_MIN = 2000;
export const HOLIDAY_YEAR_MAX = 2100;

const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';
export const HOLIDAY_YEAR_RANGE_MESSAGE = `Choisissez une année entre ${HOLIDAY_YEAR_MIN} et ${HOLIDAY_YEAR_MAX}.`;

export const holidayYearSchema = z
  .number()
  .int(HOLIDAY_YEAR_RANGE_MESSAGE)
  .min(HOLIDAY_YEAR_MIN, HOLIDAY_YEAR_RANGE_MESSAGE)
  .max(HOLIDAY_YEAR_MAX, HOLIDAY_YEAR_RANGE_MESSAGE);

export const publicHolidaySchema = z.object({ date: workDateSchema, label: z.string() });

export type PublicHoliday = z.infer<typeof publicHolidaySchema>;

export const publicHolidayListSchema = z.array(publicHolidaySchema);

export const createPublicHolidayRequestSchema = z.strictObject(
  {
    date: workDateSchema,
    label: z
      .string()
      .trim()
      .min(1, 'Libellé requis.')
      .max(MAX_NAME_LENGTH, `${MAX_NAME_LENGTH} caractères maximum.`),
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type CreatePublicHolidayRequest = z.infer<typeof createPublicHolidayRequestSchema>;

export const publicHolidayImportRequestSchema = z.strictObject(
  { year: holidayYearSchema },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export const publicHolidayImportResultSchema = z.object({ addedCount: z.number().int() });
