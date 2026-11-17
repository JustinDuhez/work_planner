import { Skeleton } from '../ui/skeleton';

const MONTHS_PER_PERIOD = 12;

/** Twelve month cards, so the page does not jump when the calendar arrives. */
export function CalendarSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: MONTHS_PER_PERIOD }, (_, index) => (
          <div key={index} className="rounded-card border border-line bg-white p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The year summary card, in the aside slot so the layout is the same as when loaded. */
export function SummarySkeleton() {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-4 h-4 w-40" />
      <Skeleton className="mt-2 h-4 w-32" />
    </div>
  );
}
