import { compareFrench, comparePeopleByName } from './french-order';

describe('French order', () => {
  it('sorts accented names where a French reader expects them', () => {
    expect(['Zoé', 'Émilie', 'Eric', 'Élodie'].sort(compareFrench)).toEqual([
      'Élodie',
      'Émilie',
      'Eric',
      'Zoé',
    ]);
  });

  it('sorts people by last name, then first name', () => {
    const people = [
      { firstName: 'Léa', lastName: 'Moreau' },
      { firstName: 'Hugo', lastName: 'Laurent' },
      { firstName: 'Anne', lastName: 'Moreau' },
    ];
    expect([...people].sort(comparePeopleByName).map((person) => person.firstName)).toEqual([
      'Hugo',
      'Anne',
      'Léa',
    ]);
  });
});
