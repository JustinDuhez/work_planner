import { useId, type ReactNode } from 'react';

export interface ControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

/** A labelled control whose error (or hint) is its accessible description. */
export function Field({
  label,
  error,
  hint,
  className = 'space-y-1 text-sm font-medium',
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="block">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error !== undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message ? (
        <p
          id={messageId}
          className={`text-xs font-normal ${error ? 'text-rose-700' : 'text-zinc-500'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
