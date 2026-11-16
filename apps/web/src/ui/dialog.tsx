import { useEffect, useId, useRef, type ReactNode } from 'react';

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

  useEffect(() => {
    // The opener gets focus back when the dialog leaves (keyboard users keep their place).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.showModal();
    return () => opener?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`m-auto ${widthClass} rounded-card border border-line bg-white p-6 shadow-popover backdrop:bg-zinc-900/30 motion-safe:animate-[dialog-in_150ms_ease-out]`}
    >
      <h2 id={titleId} className="mb-4 text-base font-semibold text-balance">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
