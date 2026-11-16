import { CircleAlert, RotateCw } from 'lucide-react';
import { copy } from '../copy';
import { Button } from './button';

export function ErrorState({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-line bg-white px-4 py-8 text-center"
    >
      <CircleAlert size={20} aria-hidden className="text-rose-600" />
      <p className="text-sm text-zinc-700">{message}</p>
      <Button variant="secondary" isBusy={isRetrying} onClick={isRetrying ? undefined : onRetry}>
        <RotateCw size={16} aria-hidden /> {copy.states.retry}
      </Button>
    </div>
  );
}
