import type { ReactNode, Ref } from 'react';

const VARIANT_CLASS = {
  primary: 'bg-primary-600 text-on-primary hover:bg-primary-700',
  secondary: 'border border-line bg-surface text-zinc-800 hover:bg-zinc-50',
  ghost: 'text-zinc-700 hover:bg-zinc-100',
} as const;

// `hero` is the page's one main action: full width on phones, where the thumb reaches it.
const SIZE_CLASS = {
  md: 'h-10 px-4 text-sm',
  hero: 'h-12 w-full px-6 text-base sm:w-auto sm:min-w-48',
} as const;

export interface ButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: keyof typeof VARIANT_CLASS;
  size?: keyof typeof SIZE_CLASS;
  isPending?: boolean;
  isDisabled?: boolean;
  // Busy but still focusable (aria-disabled, not disabled): a retry keeps the user's place.
  isBusy?: boolean;
  describedBy?: string;
  // Overrides the visible text as the accessible name, to say what the action applies to.
  label?: string;
  ref?: Ref<HTMLButtonElement>;
  onClick?: () => void;
}

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isPending = false,
  isDisabled = false,
  isBusy = false,
  describedBy,
  label,
  ref,
  onClick,
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isPending || isDisabled}
      aria-busy={isPending || isBusy}
      aria-disabled={isBusy || undefined}
      aria-describedby={describedBy}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  );
}
