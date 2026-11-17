import { focusFirstInvalid } from './field-error';

function formWith(html: string): HTMLFormElement {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.append(form);
  return form;
}

describe('focusFirstInvalid', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the first invalid control in document order', () => {
    const form = formWith(
      '<input id="a" aria-invalid="false"><input id="b" aria-invalid="true"><input id="c" aria-invalid="true">',
    );

    focusFirstInvalid(form);

    expect(document.activeElement?.id).toBe('b');
  });

  it('leaves focus alone when nothing is invalid', () => {
    const form = formWith('<input id="a" aria-invalid="false"><input id="b">');

    focusFirstInvalid(form);

    expect(document.activeElement).toBe(document.body);
  });
});
