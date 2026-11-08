import { z } from 'zod';

export const workDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.');
