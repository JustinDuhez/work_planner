import type { ReactNode } from 'react';

/**
 * E8b2-D1: the sticky bar, then the main content and its summary card. The aside follows the
 * main content in the DOM (screen-reader order) but shows above it on phones.
 */
export function PageLayout({
  bar,
  main,
  aside,
}: {
  bar: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        {bar}
      </div>
      <div className={aside ? 'grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start' : ''}>
        <div className="min-w-0">{main}</div>
        {aside ? (
          <div
            data-slot="aside"
            className="order-first lg:sticky lg:top-36 lg:order-none lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto"
          >
            {aside}
          </div>
        ) : null}
      </div>
    </div>
  );
}
