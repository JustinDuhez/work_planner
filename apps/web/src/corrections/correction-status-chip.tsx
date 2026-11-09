import type { ClockCorrectionStatus } from '@work-planner/domain';
import { copy } from '../copy';

const CHIP_BY_STATUS: Record<ClockCorrectionStatus, { label: string; className: string }> = {
  pending: { label: copy.corrections.statusPending, className: 'bg-zinc-100 text-zinc-700' },
  accepted: { label: copy.corrections.statusAccepted, className: 'bg-zinc-50 text-zinc-500' },
  refused: { label: copy.corrections.statusRefused, className: 'bg-rose-50 text-rose-700' },
  superseded: { label: copy.corrections.statusSuperseded, className: 'bg-zinc-50 text-zinc-500' },
};

export function CorrectionStatusChip({
  status,
  onOpen,
}: {
  status: ClockCorrectionStatus;
  onOpen: () => void;
}) {
  const { label, className } = CHIP_BY_STATUS[status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium hover:underline ${className}`}
    >
      {label}
    </button>
  );
}
