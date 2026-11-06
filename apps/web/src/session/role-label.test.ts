import { initialsOf, roleLabel } from './role-label';

describe('roleLabel', () => {
  it.each([
    [{ isAdmin: false, isManager: false }, 'Collaborateur'],
    [{ isAdmin: false, isManager: true }, 'Manager'],
    [{ isAdmin: true, isManager: false }, 'Administrateur'],
    [{ isAdmin: true, isManager: true }, 'Manager · Administrateur'],
  ])('labels %o as %s', (roles, expected) => {
    expect(roleLabel(roles)).toBe(expected);
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first and last name, in uppercase', () => {
    expect(initialsOf('léa', 'moreau')).toBe('LM');
  });

  it('keeps accented letters', () => {
    expect(initialsOf('Émile', 'Ödegaard')).toBe('ÉÖ');
  });
});
