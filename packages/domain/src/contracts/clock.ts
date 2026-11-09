import { z } from 'zod';
import { weekCountersSchema } from './counters';
import { workDateSchema } from './work-date';

export { workDateSchema } from './work-date';

export const WORK_MODES = ['on_site', 'telework'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';

export const workModeSchema = z.enum(WORK_MODES, 'Mode de travail invalide.');
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM).');
export const isoWeekSchema = z.string().regex(/^\d{4}-W\d{2}$/, 'Semaine invalide.');

export const startClockPeriodRequestSchema = z
  .strictObject(
    {
      startedAt: localTimeSchema.optional(),
      endedAt: localTimeSchema.optional(),
      workMode: workModeSchema.optional(),
    },
    { error: UNKNOWN_FIELDS_MESSAGE },
  )
  .refine((body) => body.endedAt === undefined || body.startedAt !== undefined, {
    message: 'Heure de début requise.',
    path: ['startedAt'],
  });

export type StartClockPeriodRequest = z.infer<typeof startClockPeriodRequestSchema>;

export const updateClockPeriodRequestSchema = z
  .strictObject(
    {
      startedAt: localTimeSchema.optional(),
      endedAt: z.union([localTimeSchema, z.literal('now')]).optional(),
    },
    { error: UNKNOWN_FIELDS_MESSAGE },
  )
  .refine((body) => body.startedAt !== undefined || body.endedAt !== undefined, {
    message: 'Aucune modification demandée.',
    path: ['form'],
  });

export type UpdateClockPeriodRequest = z.infer<typeof updateClockPeriodRequestSchema>;

export const updateClockDayRequestSchema = z.strictObject(
  { workMode: workModeSchema },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export const clockPeriodSchema = z.object({
  id: z.number().int(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

export type ClockPeriodView = z.infer<typeof clockPeriodSchema>;

export const clockDaySchema = z.object({
  date: workDateSchema,
  workMode: workModeSchema.nullable(),
  periods: z.array(clockPeriodSchema),
  workedMinutes: z.number().int(),
  badgeableMinutes: z.number().int(),
  isToday: z.boolean(),
  isFuture: z.boolean(),
  isUnclosed: z.boolean(),
  canEdit: z.boolean(),
  canClose: z.boolean(),
});

export type ClockDayView = z.infer<typeof clockDaySchema>;

export const clockDayModeSchema = z.object({ date: workDateSchema, workMode: workModeSchema });

export type ClockDayMode = z.infer<typeof clockDayModeSchema>;

export const userSummarySchema = z.object({
  id: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const userSummaryListSchema = z.array(userSummarySchema);

export const clockWeekSchema = z.object({
  user: userSummarySchema,
  isoWeek: isoWeekSchema,
  // The server's clock when it answered: the web derives its offset from it for the live counter.
  serverNow: z.iso.datetime(),
  days: z.array(clockDaySchema).length(7),
  weekWorkedMinutes: z.number().int(),
  counters: weekCountersSchema,
});

export type ClockWeek = z.infer<typeof clockWeekSchema>;
