import {
  formatDayMonth,
  isWeekendDate,
  type CalendarHalfDay,
  type DayTypeView,
} from '@work-planner/domain';
import { copy } from '../copy';
import { DAY_TYPE_CHIP_CLASSES, FALLBACK_CHIP_CLASSES } from '../leave/half-day-chips';

const DAYS_PER_WEEK = 7;
const HALVES = ['am', 'pm'] as const;
type HalfName = (typeof HALVES)[number];
const monthTitle = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function halfKey(date: string, half: HalfName): string {
  return `${date}:${half}`;
}

// Returns the click handler of a half-day, or nothing when it is not actionable.
export type HalfAction = (
  date: string,
  half: HalfName,
  declared: CalendarHalfDay | undefined,
) => (() => void) | undefined;

function HalfCell({
  date,
  half,
  declared,
  holidayLabel,
  dayTypes,
  onClick,
}: {
  date: string;
  half: HalfName;
  declared: CalendarHalfDay | undefined;
  holidayLabel: string | undefined;
  dayTypes: readonly DayTypeView[];
  onClick: (() => void) | undefined;
}) {
  let background = isWeekendDate(date) ? 'bg-zinc-100' : '';
  let text: string | null = null;
  if (declared) {
    const chip = DAY_TYPE_CHIP_CLASSES[declared.dayTypeCode] ?? FALLBACK_CHIP_CLASSES;
    const isPending = declared.status === 'pending';
    background = isPending ? chip.pending : chip.approved;
    const label =
      dayTypes.find((type) => type.code === declared.dayTypeCode)?.label ?? declared.dayTypeCode;
    const halfWord = half === 'am' ? copy.calendar.morning : copy.calendar.afternoon;
    text = `${formatDayMonth(date)} : ${label} · ${halfWord}${isPending ? ` ${copy.calendar.pending}` : ''}`;
  } else if (holidayLabel !== undefined) {
    background = 'bg-amber-50';
    // Said once per day: the holiday covers both halves.
    if (half === 'am')
      text = `${formatDayMonth(date)} : ${copy.calendar.holiday} · ${holidayLabel}`;
  }
  if (onClick) {
    // A free half has no label yet: name it by its date and half, like a declared one does.
    const halfWord = half === 'am' ? copy.calendar.morning : copy.calendar.afternoon;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block h-3 w-full cursor-pointer hover:bg-primary-100 ${background}`}
      >
        <span className="sr-only">{text ?? `${formatDayMonth(date)} : ${halfWord}`}</span>
      </button>
    );
  }
  return (
    <span className={`block h-3 ${background}`}>
      {text ? <span className="sr-only">{text}</span> : null}
    </span>
  );
}

function DayCell({
  date,
  day,
  isInPeriod,
  isToday,
  halfDaysByKey,
  holidaysByDate,
  dayTypes,
  halfAction,
}: {
  date: string;
  day: number;
  isInPeriod: boolean;
  isToday: boolean;
  halfDaysByKey: ReadonlyMap<string, CalendarHalfDay>;
  holidaysByDate: ReadonlyMap<string, string>;
  dayTypes: readonly DayTypeView[];
  halfAction: HalfAction | undefined;
}) {
  const holidayLabel = holidaysByDate.get(date);
  return (
    <td title={holidayLabel} className={`p-0.5 ${isInPeriod ? '' : 'opacity-40'}`}>
      <div className={`overflow-hidden rounded ${isToday ? 'ring-1 ring-primary-500' : ''}`}>
        <span aria-hidden className="block px-0.5 text-[10px] leading-4 text-zinc-600">
          {day}
        </span>
        {HALVES.map((half) => {
          const declared = halfDaysByKey.get(halfKey(date, half));
          return (
            <HalfCell
              key={half}
              date={date}
              half={half}
              declared={declared}
              holidayLabel={holidayLabel}
              dayTypes={dayTypes}
              onClick={isInPeriod ? halfAction?.(date, half, declared) : undefined}
            />
          );
        })}
      </div>
    </td>
  );
}

export function MonthCard({
  year,
  month,
  period,
  halfDaysByKey,
  holidaysByDate,
  dayTypes,
  today,
  halfAction,
}: {
  year: number;
  month: number;
  period: { startDate: string; endDate: string };
  halfDaysByKey: ReadonlyMap<string, CalendarHalfDay>;
  holidaysByDate: ReadonlyMap<string, string>;
  dayTypes: readonly DayTypeView[];
  today: string;
  halfAction?: HalfAction;
}) {
  const leadingBlanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % DAYS_PER_WEEK;
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const slots: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];
  while (slots.length % DAYS_PER_WEEK !== 0) slots.push(null);
  const weeks = Array.from({ length: slots.length / DAYS_PER_WEEK }, (_, week) =>
    slots.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK),
  );
  return (
    <table className="w-full table-fixed rounded-card border border-zinc-200 bg-white">
      <caption className="px-2 pt-2 text-left text-sm font-semibold first-letter:uppercase">
        {monthTitle.format(new Date(Date.UTC(year, month - 1, 1, 12)))}
      </caption>
      <thead>
        <tr>
          {copy.calendar.weekdayInitials.map((initial, index) => (
            <th key={index} scope="col" className="text-[10px] font-medium text-zinc-500">
              {initial}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, weekIndex) => (
          <tr key={weekIndex}>
            {week.map((day, index) => {
              if (day === null) return <td key={index} />;
              const date = isoDate(year, month, day);
              return (
                <DayCell
                  key={date}
                  date={date}
                  day={day}
                  isInPeriod={date >= period.startDate && date <= period.endDate}
                  isToday={date === today}
                  halfDaysByKey={halfDaysByKey}
                  holidaysByDate={holidaysByDate}
                  dayTypes={dayTypes}
                  halfAction={halfAction}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
