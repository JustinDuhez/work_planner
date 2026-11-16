import type { ReactNode } from 'react';

const VARIANT_CLASS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  secondary: 'border border-line bg-white text-zinc-800 hover:bg-zinc-50',
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
  describedBy?: string;
  onClick?: () => void;
}

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isPending = false,
  isDisabled = false,
  describedBy,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isPending || isDisabled}
      aria-busy={isPending}
      aria-describedby={describedBy}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  );
}
