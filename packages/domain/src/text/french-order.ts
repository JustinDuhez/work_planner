/** One collation for every name list (DB collations differ between local Windows and Neon). */
export function compareFrench(first: string, second: string): number {
  return first.localeCompare(second, 'fr');
}

export function comparePeopleByName(
  first: { firstName: string; lastName: string },
  second: { firstName: string; lastName: string },
): number {
  return (
    compareFrench(first.lastName, second.lastName) ||
    compareFrench(first.firstName, second.firstName)
  );
}
