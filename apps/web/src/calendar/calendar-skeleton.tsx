import { copy } from '../copy';
import { PageLayout } from '../ui/page-layout';
import { LoadingRegion, Skeleton } from '../ui/skeleton';

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

/** The whole page before the period is known: same layout as the loaded calendar. */
export function CalendarPageSkeleton() {
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-balance">{copy.calendar.title}</h1>
      <PageLayout
        bar={<Skeleton className="h-9 w-56" />}
        main={
          <LoadingRegion label={copy.calendar.loading}>
            <CalendarSkeleton />
          </LoadingRegion>
        }
        aside={<SummarySkeleton />}
      />
    </section>
  );
}
