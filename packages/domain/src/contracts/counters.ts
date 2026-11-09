import { z } from 'zod';
import { workDateSchema } from './work-date';

export const counterResetSchema = z.object({
  id: z.number().int(),
  resetDate: workDateSchema,
  authorName: z.string(),
  createdAt: z.iso.datetime(),
});

export type CounterResetView = z.infer<typeof counterResetSchema>;

export const counterResetListSchema = z.array(counterResetSchema);

export const createCounterResetRequestSchema = z.strictObject(
  { resetDate: workDateSchema.optional() },
  { error: 'Champs non autorisés.' },
);

export type CreateCounterResetRequest = z.infer<typeof createCounterResetRequestSchema>;

export const weekCountersSchema = z.object({
  weekTargetMinutes: z.number().int(),
  weekBadgeableMinutes: z.number().int(),
  weekCountedWorkedMinutes: z.number().int(),
  weekGapMinutes: z.number().int(),
  globalGapMinutes: z.number().int(),
  startDate: workDateSchema,
  countingStartDate: workDateSchema,
  // Today's open period: the web keeps both gaps ticking from it.
  runningSince: z.iso.datetime().nullable(),
  canResetCounter: z.boolean(),
  // E5-D5: a counted day whose latest correction was refused.
  hasOpenRefusal: z.boolean(),
  canViewCorrections: z.boolean(),
  lastReset: counterResetSchema.nullable(),
});

export type WeekCounters = z.infer<typeof weekCountersSchema>;
