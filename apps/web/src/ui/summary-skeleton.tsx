import { Skeleton } from './skeleton';

/** The summary card, in the aside slot so the layout is the same as when loaded. */
export function SummarySkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-4 h-4 w-40" />
      <Skeleton className="mt-2 h-4 w-32" />
    </div>
  );
}
