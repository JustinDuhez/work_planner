import { formatDayCount, type DayTypeView, type YearCalendar } from '@work-planner/domain';
import { copy } from '../copy';
import { DAY_TYPE_CHIP_CLASSES, FALLBACK_CHIP_CLASSES } from '../leave/half-day-chips';
import { Stat } from '../ui/stat';
import { SummaryCard } from '../ui/summary-card';

// The domain formatter owns the French number ("14,5"); the unit is shown separately.
const dayNumber = (halfDays: number) => formatDayCount(halfDays).split(' ')[0] ?? '';

function typeInfo(dayTypes: readonly DayTypeView[], code: string) {
  return {
    label: dayTypes.find((type) => type.code === code)?.label ?? code,
    classes: DAY_TYPE_CHIP_CLASSES[code] ?? FALLBACK_CHIP_CLASSES,
  };
}

export function CalendarLegend({
  calendar,
  dayTypes,
}: {
  calendar: YearCalendar;
  dayTypes: readonly DayTypeView[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
      {calendar.summary.map((usage) => {
        const { label, classes } = typeInfo(dayTypes, usage.dayTypeCode);
        return (
          <li key={usage.dayTypeCode} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-full ${classes.approved}`} />
            {label}
          </li>
        );
      })}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full bg-amber-200" />
        {copy.calendar.holiday}
      </li>
      <li>{copy.calendar.legendPending}</li>
    </ul>
  );
}

export function UsageSummaryPanel({
  calendar,
  dayTypes,
  title,
}: {
  calendar: YearCalendar;
  dayTypes: readonly DayTypeView[];
  title: string;
}) {
  const approvedTotal = calendar.summary.reduce((sum, usage) => sum + usage.approvedHalfDays, 0);
  return (
    <SummaryCard title={title}>
      <Stat
        label={copy.calendar.approvedTotal}
        value={dayNumber(approvedTotal)}
        unit={copy.calendar.dayUnit}
      />
      {calendar.summary.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.calendar.noAbsence}</p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {calendar.summary.map((usage) => {
          const { label, classes } = typeInfo(dayTypes, usage.dayTypeCode);
          return (
            <li key={usage.dayTypeCode} className="flex items-center gap-2">
              <span aria-hidden className={`size-2.5 rounded-full ${classes.approved}`} />
              <span className="flex-1">
                {label}
                {usage.pendingHalfDays > 0 ? (
                  <span className="block text-xs text-zinc-500">
                    {`+${dayNumber(usage.pendingHalfDays)} ${copy.calendar.dayUnit} ${copy.calendar.pendingSuffix}`}
                  </span>
                ) : null}
              </span>
              <span className="font-semibold tabular-nums">
                {`${dayNumber(usage.approvedHalfDays)} ${copy.calendar.dayUnit}`}
              </span>
            </li>
          );
        })}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-amber-200" />
          <span className="flex-1">{copy.calendar.holidays}</span>
          <span className="font-semibold tabular-nums">{calendar.holidayCount}</span>
        </li>
      </ul>
    </SummaryCard>
  );
}
