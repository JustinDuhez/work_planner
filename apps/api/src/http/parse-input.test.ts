import { ValidationError } from '@work-planner/domain';
import { z } from 'zod';
import { FORM_FIELD_ERROR_KEY, parseInput } from './parse-input';

const profileSchema = z.strictObject({
  firstName: z.string().trim().min(1, 'Prénom requis.'),
  address: z.object({ city: z.string().min(1, 'Ville requise.') }),
});

function captureValidationError(input: unknown): ValidationError {
  try {
    parseInput(profileSchema, input);
  } catch (error) {
    if (error instanceof ValidationError) return error;
  }
  throw new Error('Expected a ValidationError');
}

describe('parseInput', () => {
  it('returns the parsed and transformed value when the input is valid', () => {
    expect(parseInput(profileSchema, { firstName: '  Alice ', address: { city: 'Lyon' } })).toEqual(
      {
        firstName: 'Alice',
        address: { city: 'Lyon' },
      },
    );
  });

  it('reports each invalid field under its path with the schema message', () => {
    const error = captureValidationError({ firstName: ' ', address: { city: '' } });

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Certains champs sont invalides.');
    expect(error.fieldErrors).toEqual({
      firstName: 'Prénom requis.',
      'address.city': 'Ville requise.',
    });
  });

  it('reports unexpected fields as a form-level error', () => {
    const error = captureValidationError({ firstName: 'A', address: { city: 'Lyon' }, email: 'x' });

    expect(error.fieldErrors).toHaveProperty(FORM_FIELD_ERROR_KEY);
  });

  it('keeps only the first message when a field breaks several rules', () => {
    const schema = z.object({ code: z.string().min(3, 'Trop court.').regex(/^\d+$/, 'Chiffres.') });
    let fieldErrors: unknown;
    try {
      parseInput(schema, { code: 'a' });
    } catch (error) {
      fieldErrors = error instanceof ValidationError ? error.fieldErrors : undefined;
    }

    expect(fieldErrors).toEqual({ code: 'Trop court.' });
  });
});
