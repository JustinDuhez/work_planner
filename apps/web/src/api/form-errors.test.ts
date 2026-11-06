import { ApiError } from './api-client';
import { bannerMessageFor } from './form-errors';

const FIELDS = ['firstName', 'lastName'];

describe('bannerMessageFor', () => {
  it('shows nothing when there is no error', () => {
    expect(bannerMessageFor(null, FIELDS)).toBeUndefined();
  });

  it('shows the message of an error that is not an API error', () => {
    expect(bannerMessageFor(new TypeError('boom'), FIELDS)).toBe('boom');
  });

  it('shows the message of an API error without field errors', () => {
    expect(bannerMessageFor(new ApiError(500, 'INTERNAL_ERROR', 'Erreur'), FIELDS)).toBe('Erreur');
  });

  it('leaves the display to the fields when one of them shows an error', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalide', { firstName: 'Requis' });

    expect(bannerMessageFor(error, FIELDS)).toBeUndefined();
  });

  it('shows the message when the field errors belong to no rendered field', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalide', { email: 'Interdit' });

    expect(bannerMessageFor(error, FIELDS)).toBe('Invalide');
  });

  it('prefers the form-level message over the generic one', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalide', { form: 'Formulaire refusé' });

    expect(bannerMessageFor(error, FIELDS)).toBe('Formulaire refusé');
  });
});
