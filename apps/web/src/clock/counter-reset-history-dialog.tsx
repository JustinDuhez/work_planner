import { useEffect, useRef } from 'react';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { formatDateTime, formatLongDate } from './clock-time';
import { useCounterResets } from './counter-queries';

export function CounterResetHistoryDialog({
  ownerId,
  onClose,
}: {
  ownerId: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resets = useCounterResets(ownerId);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.counters.historyTitle}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <h2 className="text-base font-semibold">{copy.counters.historyTitle}</h2>
      {resets.isError ? (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.counters.loadError}
        </p>
      ) : null}
      {resets.data?.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{copy.counters.historyEmpty}</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {resets.data?.map((reset) => (
          <li key={reset.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            <p className="font-medium">{formatLongDate(reset.resetDate)}</p>
            <p className="text-xs text-zinc-500">
              {`${copy.counters.historyBy} ${reset.authorName} ${copy.counters.historyOn} ${formatDateTime(reset.createdAt)}`}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {copy.counters.close}
        </Button>
      </div>
    </dialog>
  );
}
