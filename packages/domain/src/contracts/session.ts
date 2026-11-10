import { z } from 'zod';

/** Upper bound on what the server accepts, so a huge body cannot make argon2 hash megabytes. */
export const MAX_SUBMITTED_PASSWORD_LENGTH = 1024;
const MAX_NAME_LENGTH = 100;
// RFC 5321 maximum; also bounds the size of the login rate-limiter keys.
const MAX_EMAIL_LENGTH = 254;

export const currentUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dailyMinutes: z.number().int(),
  roles: z.object({ isAdmin: z.boolean(), isManager: z.boolean() }),
  teams: z.array(z.object({ id: z.number().int(), name: z.string(), isManager: z.boolean() })),
  directManagers: z.array(
    z.object({ id: z.number().int(), firstName: z.string(), lastName: z.string() }),
  ),
  mustChangePassword: z.boolean(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const sessionResponseSchema = z.object({
  user: currentUserSchema,
  csrfToken: z.string(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH, 'Adresse email invalide.')
  .pipe(z.email('Adresse email invalide.'));

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Mot de passe requis.')
    .max(MAX_SUBMITTED_PASSWORD_LENGTH, 'Mot de passe trop long.'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const personNameSchema = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(MAX_NAME_LENGTH, `${MAX_NAME_LENGTH} caractères maximum.`);

export const updateProfileRequestSchema = z.strictObject(
  { firstName: personNameSchema('Prénom requis.'), lastName: personNameSchema('Nom requis.') },
  { error: 'Champs non autorisés.' },
);

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z.strictObject(
  {
    currentPassword: z
      .string()
      .min(1, 'Mot de passe actuel requis.')
      .max(MAX_SUBMITTED_PASSWORD_LENGTH, 'Mot de passe trop long.'),
    newPassword: z.string().max(MAX_SUBMITTED_PASSWORD_LENGTH, 'Mot de passe trop long.'),
  },
  { error: 'Champs non autorisés.' },
);

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
