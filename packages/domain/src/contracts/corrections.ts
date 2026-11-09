import { z } from 'zod';
import { localTimeSchema, userSummarySchema, workModeSchema } from './clock';
import { clockCorrectionStatusSchema } from './correction-status';
import { workDateSchema } from './work-date';

export const CORRECTION_COMMENT_MAX_LENGTH = 500;
const MAX_DATABASE_ID = 2_147_483_647;
const MAX_PERIODS_PER_DAY = 20;
const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';

const commentSchema = z
  .string()
  .trim()
  .max(CORRECTION_COMMENT_MAX_LENGTH, 'Le commentaire ne peut pas dépasser 500 caractères.');

const correctionPeriodRequestSchema = z.strictObject(
  { startedAt: localTimeSchema, endedAt: localTimeSchema },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export const createClockCorrectionRequestSchema = z.strictObject(
  {
    userId: z
      .number()
      .int()
      .positive('Utilisateur invalide.')
      .max(MAX_DATABASE_ID, 'Utilisateur invalide.'),
    date: workDateSchema,
    workMode: workModeSchema,
    periods: z.array(correctionPeriodRequestSchema).max(MAX_PERIODS_PER_DAY, 'Trop de périodes.'),
    comment: commentSchema.optional(),
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type CreateClockCorrectionRequest = z.infer<typeof createClockCorrectionRequestSchema>;

export const answerClockCorrectionRequestSchema = z.strictObject(
  {
    status: z.enum(['accepted', 'refused'], 'Réponse invalide.'),
    responseComment: commentSchema.optional(),
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type AnswerClockCorrectionRequest = z.infer<typeof answerClockCorrectionRequestSchema>;

const correctionDaySchema = z.object({
  workMode: workModeSchema.nullable(),
  periods: z.array(z.object({ startedAt: z.iso.datetime(), endedAt: z.iso.datetime().nullable() })),
  workedMinutes: z.number().int(),
});

export const clockCorrectionSchema = z.object({
  id: z.number().int(),
  user: userSummarySchema,
  author: userSummarySchema,
  workDate: workDateSchema,
  status: clockCorrectionStatusSchema,
  comment: z.string().nullable(),
  responseComment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  respondedAt: z.iso.datetime().nullable(),
  before: correctionDaySchema,
  after: correctionDaySchema,
  differenceMinutes: z.number().int(),
  canAnswer: z.boolean(),
});

export type ClockCorrectionView = z.infer<typeof clockCorrectionSchema>;

export const clockCorrectionListSchema = z.array(clockCorrectionSchema);
