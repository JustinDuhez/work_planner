import { formatDayCount, type DayTypeView, type YearCalendar } from '@work-planner/domain';
import { copy } from '../copy';
import { DAY_TYPE_CHIP_CLASSES, FALLBACK_CHIP_CLASSES } from '../leave/half-day-chips';

export function UsageSummaryPanel({
  calendar,
  dayTypes,
}: {
  calendar: YearCalendar;
  dayTypes: readonly DayTypeView[];
}) {
  return (
    <section
      aria-label={copy.calendar.summaryTitle}
      className="space-y-2 rounded-card border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold">{copy.calendar.summaryTitle}</h2>
      {calendar.summary.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.calendar.noAbsence}</p>
      ) : null}
      <ul className="space-y-1 text-sm">
        {calendar.summary.map((usage) => {
          const label =
            dayTypes.find((type) => type.code === usage.dayTypeCode)?.label ?? usage.dayTypeCode;
          const classes = DAY_TYPE_CHIP_CLASSES[usage.dayTypeCode] ?? FALLBACK_CHIP_CLASSES;
          const pending =
            usage.pendingHalfDays > 0
              ? ` (${copy.calendar.pendingPrefix}${formatDayCount(usage.pendingHalfDays)} ${copy.calendar.pendingSuffix})`
              : '';
          return (
            <li key={usage.dayTypeCode} className="flex items-center gap-2">
              <span aria-hidden className={`size-3 rounded-full ${classes.approved}`} />
              <span>{`${label} · ${formatDayCount(usage.approvedHalfDays)}${pending}`}</span>
            </li>
          );
        })}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-amber-200" />
          <span>{`${copy.calendar.holidays} · ${calendar.holidayCount}`}</span>
        </li>
      </ul>
    </section>
  );
}
