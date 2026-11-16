import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const DEFAULT_WIDTH = 'w-[min(24rem,calc(100vw-2rem))]';

export function Dialog({
  title,
  onClose,
  children,
  widthClass = DEFAULT_WIDTH,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // The opener gets focus back when the dialog leaves (keyboard users keep their place). Read at
  // render: under StrictMode the effect runs a second time with focus already inside the dialog.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    // A parent re-render must never call showModal twice (it throws on an open dialog).
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => opener?.focus();
  }, [opener]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`m-auto max-h-[calc(100dvh-2rem)] ${widthClass} overflow-y-auto rounded-card border border-line bg-white p-6 shadow-popover backdrop:bg-zinc-900/30 motion-safe:animate-[dialog-in_150ms_ease-out]`}
    >
      <h2 id={titleId} className="mb-4 text-base font-semibold text-balance">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
