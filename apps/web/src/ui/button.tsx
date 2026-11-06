import type { ReactNode } from 'react';

const VARIANT_CLASS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-500/60',
  secondary: 'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50',
  ghost: 'text-zinc-700 hover:bg-zinc-100',
} as const;

export interface ButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: keyof typeof VARIANT_CLASS;
  isPending?: boolean;
  onClick?: () => void;
}

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  isPending = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isPending}
      aria-busy={isPending}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  );
}
