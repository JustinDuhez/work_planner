import { z } from 'zod';
import { MAX_SUBMITTED_PASSWORD_LENGTH, emailSchema, personNameSchema } from './session';
import { userSummarySchema } from './clock';
import { workDateSchema } from './work-date';

const MAX_DAILY_MINUTES = 1440;
const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';

export const dailyMinutesSchema = z
  .number()
  .int('Durée invalide.')
  .min(1, 'La durée doit être comprise entre 0:01 et 24:00.')
  .max(MAX_DAILY_MINUTES, 'La durée doit être comprise entre 0:01 et 24:00.');

const passwordInputSchema = z
  .string()
  .max(MAX_SUBMITTED_PASSWORD_LENGTH, 'Mot de passe trop long.');

export const directoryEntrySchema = z.object({
  id: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
  isManager: z.boolean(),
  isBlocked: z.boolean(),
  isArchived: z.boolean(),
  teams: z.array(z.object({ id: z.number().int(), name: z.string() })),
  managers: z.array(userSummarySchema),
  canManage: z.boolean(),
  canEditWorkingTime: z.boolean(),
  // Only for viewers allowed to edit it (spec §4).
  workingTime: z
    .object({
      dailyMinutes: z.number().int(),
      startDate: workDateSchema,
      plannedChange: z
        .object({ effectiveDate: workDateSchema, dailyMinutes: z.number().int() })
        .nullable(),
    })
    .nullable(),
});

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;

export const directorySchema = z.array(directoryEntrySchema);

export const createUserRequestSchema = z.strictObject(
  {
    firstName: personNameSchema('Prénom requis.'),
    lastName: personNameSchema('Nom requis.'),
    email: emailSchema,
    isAdmin: z.boolean(),
    dailyMinutes: dailyMinutesSchema.optional(),
    startDate: workDateSchema.optional(),
    initialPassword: passwordInputSchema,
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .strictObject(
    {
      firstName: personNameSchema('Prénom requis.').optional(),
      lastName: personNameSchema('Nom requis.').optional(),
      email: emailSchema.optional(),
      isAdmin: z.boolean().optional(),
      isBlocked: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    },
    { error: UNKNOWN_FIELDS_MESSAGE },
  )
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucune modification demandée.',
    path: ['form'],
  });

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const resetPasswordRequestSchema = z.strictObject(
  { newPassword: passwordInputSchema },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const updateWorkingTimeRequestSchema = z
  .strictObject(
    {
      dailyMinutes: dailyMinutesSchema.optional(),
      effectiveDate: workDateSchema.optional(),
      startDate: workDateSchema.optional(),
    },
    { error: UNKNOWN_FIELDS_MESSAGE },
  )
  .refine((body) => body.effectiveDate === undefined || body.dailyMinutes !== undefined, {
    message: 'Indiquez la nouvelle durée.',
    path: ['dailyMinutes'],
  })
  .refine((body) => body.dailyMinutes !== undefined || body.startDate !== undefined, {
    message: 'Aucune modification demandée.',
    path: ['form'],
  });

export type UpdateWorkingTimeRequest = z.infer<typeof updateWorkingTimeRequestSchema>;
