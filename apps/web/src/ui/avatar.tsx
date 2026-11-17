const AVATAR_SIZE = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-14 text-lg',
} as const;

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase('fr');
}

/** Decorative: the person's name is always printed next to it. */
export function Avatar({
  firstName,
  lastName,
  size = 'sm',
}: {
  firstName: string;
  lastName: string;
  size?: keyof typeof AVATAR_SIZE;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700 ${AVATAR_SIZE[size]}`}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}
