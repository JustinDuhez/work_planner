import { addDays, ValidationError } from '@work-planner/domain';

export function assertRealDate(date: string, field: string): void {
  // The schema checks the shape only; 2026-02-30 would roll over to March.
  if (addDays(date, 0) !== date) {
    throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
      [field]: 'Date invalide.',
    });
  }
}
