import { Skeleton } from '../ui/skeleton';

const DAYS_IN_WEEK = 7;
const CARD = 'rounded-card border border-line bg-surface';

/** Shaped like the loaded page so nothing jumps when the week arrives. */
export function WeekSkeleton({ hasHero }: { hasHero: boolean }) {
  return (
    <div className="space-y-4">
      {hasHero ? (
        <div className={`${CARD} p-5 sm:flex sm:items-center sm:justify-between sm:p-6`}>
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-10 w-32 sm:h-12" />
          </div>
          <Skeleton className="mt-5 h-12 w-full sm:mt-0 sm:w-48" />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {['week', 'global'].map((stat) => (
          <div key={stat} className={`${CARD} p-4 sm:p-5`}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-9 w-28" />
          </div>
        ))}
      </div>
      <div className={`${CARD} divide-y divide-line`}>
        {Array.from({ length: DAYS_IN_WEEK }, (_, index) => (
          <div key={index} className="flex items-center gap-4 p-3 sm:px-4">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
