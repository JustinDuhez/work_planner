import type { ReactNode } from 'react';

export function Skeleton({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-inner-md bg-linear-to-r from-zinc-100 via-zinc-200/70 to-zinc-100 bg-size-[200%_100%] motion-safe:animate-[shimmer_1.4s_ease-in-out_infinite] ${className}`}
    />
  );
}

/** One announcement for the whole placeholder: screen readers hear the label, not the blocks. */
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
