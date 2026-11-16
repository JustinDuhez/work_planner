import { copy } from '../copy';
import { Button } from '../ui/button';
import { ErrorBanner } from '../ui/error-banner';
import { Dialog } from '../ui/dialog';
import { formatDateTime, formatLongDate } from './clock-time';
import { useCounterResets } from './counter-queries';

export function CounterResetHistoryDialog({
  ownerId,
  onClose,
}: {
  ownerId: number;
  onClose: () => void;
}) {
  const resets = useCounterResets(ownerId);

  return (
    <Dialog
      title={copy.counters.historyTitle}
      onClose={onClose}
      widthClass="w-[min(28rem,calc(100vw-2rem))]"
    >
      <ErrorBanner message={resets.isError ? copy.counters.loadError : undefined} />
      {resets.data?.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.counters.historyEmpty}</p>
      ) : null}
      <ul className="space-y-2">
        {resets.data?.map((reset) => (
          <li key={reset.id} className="rounded-control border border-line px-3 py-2 text-sm">
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
    </Dialog>
  );
}
