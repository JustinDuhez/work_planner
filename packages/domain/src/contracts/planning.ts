import { z } from 'zod';
import { counterResetSchema } from './counters';
import {
  HOLIDAY_YEAR_MAX,
  HOLIDAY_YEAR_MIN,
  HOLIDAY_YEAR_RANGE_MESSAGE,
  publicHolidaySchema,
} from './holidays';
import { calendarHalfDaySchema } from './leave';
import { workDateSchema } from './work-date';

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const MAX_BATCH_RESET_PEOPLE = 200;

export const yearMonthSchema = z
  .string()
  .regex(YEAR_MONTH_PATTERN, { error: 'Choisissez un mois valide.' })
  .refine(
    (value) => {
      const year = Number(value.slice(0, 4));
      return year >= HOLIDAY_YEAR_MIN && year <= HOLIDAY_YEAR_MAX;
    },
    { error: HOLIDAY_YEAR_RANGE_MESSAGE },
  );

export const teamMonthHalfDaySchema = calendarHalfDaySchema.omit({ leaveRequestId: true });
export type TeamMonthHalfDay = z.infer<typeof teamMonthHalfDaySchema>;

export const teamMonthSchema = z.object({
  month: z.object({ startDate: workDateSchema, endDate: workDateSchema }),
  today: workDateSchema,
  holidays: z.array(publicHolidaySchema),
  teams: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      parentTeamId: z.number().int().nullable(),
      path: z.string(),
      managerId: z.number().int().nullable(),
      memberIds: z.array(z.number().int()),
    }),
  ),
  people: z.array(
    z.object({
      id: z.number().int(),
      firstName: z.string(),
      lastName: z.string(),
      teamIds: z.array(z.number().int()),
      halfDays: z.array(teamMonthHalfDaySchema),
      balance: z.object({ globalGapMinutes: z.number().int(), hasOpenRefusal: z.boolean() }),
    }),
  ),
  canResetUserIds: z.array(z.number().int()),
  absentTodayUserIds: z.array(z.number().int()),
});
export type TeamMonth = z.infer<typeof teamMonthSchema>;

export const createCounterResetsRequestSchema = z.strictObject(
  {
    userIds: z
      .array(z.number().int().positive())
      .min(1, { error: 'Choisissez au moins une personne.' })
      .max(MAX_BATCH_RESET_PEOPLE, {
        error: `Choisissez au plus ${MAX_BATCH_RESET_PEOPLE} personnes.`,
      })
      .refine((ids) => new Set(ids).size === ids.length, {
        error: 'Une personne figure deux fois.',
      }),
    resetDate: workDateSchema.optional(),
  },
  { error: 'Champs non autorisés.' },
);
export type CreateCounterResetsRequest = z.infer<typeof createCounterResetsRequestSchema>;

export const counterResetBatchSchema = z.object({ resets: z.array(counterResetSchema) });
