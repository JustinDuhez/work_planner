import { Skeleton } from '../ui/skeleton';

const CARD_COUNT = 3;

export function RequestsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: CARD_COUNT }, (_, index) => (
        <div key={index} className="rounded-card border border-line bg-white p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
      ))}
    </div>
  );
}
