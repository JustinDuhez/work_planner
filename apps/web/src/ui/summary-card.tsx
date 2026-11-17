import { useId, type ReactNode } from 'react';

export function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <h2 id={titleId} className="text-sm font-semibold text-zinc-900">
        {title}
      </h2>
      {children}
    </section>
  );
}
