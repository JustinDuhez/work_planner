import { z } from 'zod';
import { yearStartSchema } from '../settings/year-start';

export const settingsSchema = z.object({ yearStart: z.string() });

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsRequestSchema = z.strictObject(
  { yearStart: yearStartSchema },
  { error: 'Champs non autorisés.' },
);

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
