import { z } from 'zod';

// Its own module: the clock week (contracts/clock) and the corrections contracts both use it.
export const CLOCK_CORRECTION_STATUSES = ['pending', 'accepted', 'refused', 'superseded'] as const;
export type ClockCorrectionStatus = (typeof CLOCK_CORRECTION_STATUSES)[number];
export const clockCorrectionStatusSchema = z.enum(CLOCK_CORRECTION_STATUSES, 'Statut invalide.');
