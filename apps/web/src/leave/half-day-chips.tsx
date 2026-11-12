import type { DayHalfDays, DayTypeView, PlannedHalfDay } from '@work-planner/domain';
import { copy } from '../copy';

// F6.1: pastel = pending, solid = approved. Literal class strings so Tailwind picks them up
// (the CSP forbids inline styles, so the stored hex color is not used here).
const DAY_TYPE_CHIP_CLASSES: Record<string, { approved: string; pending: string }> = {
  telework: { approved: 'bg-sky-600 text-white', pending: 'bg-sky-100 text-sky-900' },
  recovery: { approved: 'bg-violet-600 text-white', pending: 'bg-violet-100 text-violet-900' },
  sick: { approved: 'bg-red-600 text-white', pending: 'bg-red-100 text-red-900' },
  leave: { approved: 'bg-emerald-600 text-white', pending: 'bg-emerald-100 text-emerald-900' },
  training_travel: { approved: 'bg-amber-600 text-white', pending: 'bg-amber-100 text-amber-900' },
  early_departure: { approved: 'bg-pink-600 text-white', pending: 'bg-pink-100 text-pink-900' },
};
const FALLBACK_CHIP_CLASSES = {
  approved: 'bg-zinc-600 text-white',
  pending: 'bg-zinc-100 text-zinc-800',
};

function Chip({
  planned,
  dayTypes,
  halfLabel,
}: {
  planned: PlannedHalfDay;
  dayTypes: readonly DayTypeView[];
  halfLabel?: string;
}) {
  const label =
    dayTypes.find((type) => type.code === planned.dayTypeCode)?.label ?? planned.dayTypeCode;
  const isPending = planned.status === 'pending';
  const classes = DAY_TYPE_CHIP_CLASSES[planned.dayTypeCode] ?? FALLBACK_CHIP_CLASSES;
  const text = `${label}${halfLabel ? ` · ${halfLabel}` : ''}${isPending ? ` ${copy.leave.pending}` : ''}`;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isPending ? classes.pending : classes.approved}`}
    >
      {text}
    </span>
  );
}

export function HalfDayChips({
  halfDays,
  dayTypes,
}: {
  halfDays: DayHalfDays;
  dayTypes: readonly DayTypeView[];
}) {
  const { am, pm } = halfDays;
  if (!am && !pm) return null;
  const isSameAllDay = am && pm && am.dayTypeCode === pm.dayTypeCode && am.status === pm.status;
  return (
    <div className="flex flex-wrap gap-1">
      {isSameAllDay ? (
        <Chip planned={am} dayTypes={dayTypes} />
      ) : (
        <>
          {am ? <Chip planned={am} dayTypes={dayTypes} halfLabel={copy.leave.halfMorning} /> : null}
          {pm ? (
            <Chip planned={pm} dayTypes={dayTypes} halfLabel={copy.leave.halfAfternoon} />
          ) : null}
        </>
      )}
    </div>
  );
}

export function isPlannedTelework(halfDays: DayHalfDays): boolean {
  return [halfDays.am, halfDays.pm].some(
    (half) => half?.dayTypeCode === 'telework' && half.status === 'approved',
  );
}
