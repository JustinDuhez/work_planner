import { copy } from '../copy';
import { useHealth } from './use-health';

type HealthState = keyof typeof copy.health;

const DOT_CLASS_BY_STATE: Record<HealthState, string> = {
  checking: 'bg-zinc-300 animate-pulse',
  operational: 'bg-emerald-500',
  unavailable: 'bg-rose-500',
};

function toHealthState({
  isPending,
  isError,
}: {
  isPending: boolean;
  isError: boolean;
}): HealthState {
  if (isPending) return 'checking';
  if (isError) return 'unavailable';
  return 'operational';
}

export function HealthStatus() {
  const state = toHealthState(useHealth());

  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 shadow-card"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${DOT_CLASS_BY_STATE[state]}`} />
      {copy.health[state]}
    </p>
  );
}
