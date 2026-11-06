import { ApiError } from './api-client';

/**
 * The banner text of a failed form submission, or undefined when the field messages already say
 * everything. A field error that no rendered field shows must never be swallowed.
 */
export function bannerMessageFor(
  error: unknown,
  renderedFieldNames: readonly string[],
): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (!(error instanceof ApiError)) return error.message;
  if (error.fieldErrors.form !== undefined) return error.fieldErrors.form;
  const isShownByAField = renderedFieldNames.some((name) => error.fieldErrors[name] !== undefined);
  return isShownByAField ? undefined : error.message;
}
