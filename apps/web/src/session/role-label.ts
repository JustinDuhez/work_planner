import { copy } from '../copy';

export function roleLabel({
  isAdmin,
  isManager,
}: {
  isAdmin: boolean;
  isManager: boolean;
}): string {
  const labels: string[] = [];
  if (isManager) labels.push(copy.roles.manager);
  if (isAdmin) labels.push(copy.roles.admin);
  return labels.length === 0 ? copy.roles.collaborator : labels.join(copy.roles.separator);
}

export function initialsOf(firstName: string, lastName: string): string {
  const firstLetter = (name: string) => [...name.trim()][0]?.toLocaleUpperCase('fr-FR') ?? '';
  return `${firstLetter(firstName)}${firstLetter(lastName)}`;
}
