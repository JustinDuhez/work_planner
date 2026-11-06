import { useId, type ReactNode } from 'react';

export interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  error?: string;
  description?: string;
  autoComplete?: string;
  readOnly?: boolean;
  trailing?: ReactNode;
}

export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  error,
  description,
  autoComplete,
  readOnly = false,
  trailing,
}: TextFieldProps) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const message = error ?? description;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          readOnly={readOnly}
          autoComplete={autoComplete}
          aria-invalid={error !== undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onChange?.(event.target.value)}
          className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 read-only:bg-zinc-50 read-only:text-zinc-600 ${
            error ? 'border-rose-400' : 'border-zinc-200'
          } ${trailing ? 'pr-10' : ''}`}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {message ? (
        <p id={messageId} className={`text-xs ${error ? 'text-rose-700' : 'text-zinc-500'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
