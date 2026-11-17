import { Skeleton } from '../ui/skeleton';

const ROW_COUNT = 6;

/** A table-shaped block: the month grid on wide screens, stacked cards on phones. */
export function PlanningSkeleton() {
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4">
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
