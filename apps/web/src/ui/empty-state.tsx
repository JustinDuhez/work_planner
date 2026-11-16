import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-8 text-center">
      <Icon size={20} aria-hidden className="text-zinc-500" />
      <p className="text-sm text-zinc-600">{message}</p>
      {action}
    </div>
  );
}
