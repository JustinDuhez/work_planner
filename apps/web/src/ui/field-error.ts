import { useEffect, type RefObject } from 'react';

/** After a failed submit, keyboard and screen-reader users land on what needs fixing. */
export function focusFirstInvalid(form: HTMLElement): void {
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/**
 * Focuses the first invalid field each time `failure` changes (a new mutation error, or a
 * counter bumped by a failed local check). Keyed on the failure, not on the errors, so typing
 * in one field never steals focus towards another.
 */
export function useFocusFirstInvalid(
  formRef: RefObject<HTMLElement | null>,
  failure: unknown,
): void {
  useEffect(() => {
    if (formRef.current) focusFirstInvalid(formRef.current);
  }, [formRef, failure]);
}
