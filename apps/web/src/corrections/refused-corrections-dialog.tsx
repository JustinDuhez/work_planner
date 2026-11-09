import { useEffect, useRef } from 'react';
import { formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useClockCorrections } from './correction-queries';

export function RefusedCorrectionsDialog({
  ownerId,
  onOpen,
  onClose,
}: {
  ownerId: number;
  onOpen: (correctionId: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const corrections = useClockCorrections(ownerId, 'refused', true);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.corrections.refusedTitle}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <h2 className="text-base font-semibold">{copy.corrections.refusedTitle}</h2>
      {corrections.isError ? (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.corrections.loadError}
        </p>
      ) : null}
      {corrections.data?.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{copy.corrections.refusedEmpty}</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {corrections.data?.map((correction) => (
          <li key={correction.id}>
            <button
              type="button"
              onClick={() => onOpen(correction.id)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span className="block font-medium">{formatLongDate(correction.workDate)}</span>
              <span className="block text-xs text-zinc-500">
                {`${correction.author.firstName} ${correction.author.lastName}${correction.responseComment ? ` · ${correction.responseComment}` : ''}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {copy.corrections.close}
        </Button>
      </div>
    </dialog>
  );
}
