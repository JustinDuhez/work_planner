import { z } from 'zod';
import { userSummarySchema } from './clock';
import { MAX_NAME_LENGTH } from './session';

const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';

const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Nom de l'équipe requis.")
  .max(MAX_NAME_LENGTH, `${MAX_NAME_LENGTH} caractères maximum.`);
const teamIdSchema = z.number().int().positive('Équipe invalide.');
const personIdSchema = z.number().int().positive('Personne invalide.');

export const teamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  parentTeamId: z.number().int().nullable(),
  manager: userSummarySchema.nullable(),
  members: z.array(userSummarySchema),
  canManage: z.boolean(),
});

export type TeamView = z.infer<typeof teamSchema>;

export const teamListSchema = z.array(teamSchema);

export const createTeamRequestSchema = z.strictObject(
  {
    name: teamNameSchema,
    parentTeamId: teamIdSchema.nullable().optional(),
    managerId: personIdSchema.nullable().optional(),
    memberIds: z.array(personIdSchema).optional(),
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);

export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;

export const updateTeamRequestSchema = z
  .strictObject(
    {
      name: teamNameSchema.optional(),
      parentTeamId: teamIdSchema.nullable().optional(),
      managerId: personIdSchema.nullable().optional(),
      memberIds: z.array(personIdSchema).optional(),
    },
    { error: UNKNOWN_FIELDS_MESSAGE },
  )
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucune modification demandée.',
    path: ['form'],
  });

export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;
