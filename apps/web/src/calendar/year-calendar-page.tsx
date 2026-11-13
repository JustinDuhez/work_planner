import {
  formatDayMonth,
  HOLIDAY_YEAR_MAX,
  HOLIDAY_YEAR_MIN,
  isWeekendDate,
  monthsOfPeriod,
  periodStartYearContaining,
  toWorkDate,
  type CalendarHalfDay,
  type Half,
} from '@work-planner/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { PersonPicker } from '../clock/person-picker';
import { copy } from '../copy';
import { ErrorBanner } from '../directory/manage-user-dialog';
import { LeaveRequestDialog } from '../leave/leave-request-dialog';
import { useCancelLeaveRequest, useDayTypes } from '../leave/leave-queries';
import { NotFoundPage } from '../not-found/not-found-page';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { useSettings } from '../settings/settings-queries';
import { calendarPath, useYearCalendar } from './calendar-queries';
import { halfKey, MonthCard, type HalfAction } from './month-card';
import { UsageSummaryPanel } from './usage-summary-panel';

const periodMonthFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function periodLabel(startDate: string, endDate: string): string {
  const format = (date: string) => periodMonthFormat.format(new Date(`${date}T12:00:00Z`));
  return `${format(startDate)} – ${format(endDate)}`;
}

export function YearCalendarPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  if (!session) return null;
  const pathUserId = userId === undefined ? undefined : Number(userId);
  if (pathUserId !== undefined && !(Number.isInteger(pathUserId) && pathUserId > 0)) {
    return <NotFoundPage />;
  }
  const requested = Number(searchParams.get('periode'));
  const hasRequestedYear =
    Number.isInteger(requested) && requested >= HOLIDAY_YEAR_MIN && requested <= HOLIDAY_YEAR_MAX;
  const view = (startYear: number) => (
    <YearCalendarView
      key={`${pathUserId ?? 'me'}-${startYear}`}
      ownerId={pathUserId ?? session.user.id}
      pathUserId={pathUserId}
      viewerId={session.user.id}
      startYear={startYear}
    />
  );
  return hasRequestedYear ? view(requested) : <DefaultPeriod render={view} />;
}

// Only here is the browser date read: the period comes from the URL otherwise.
function DefaultPeriod({ render }: { render: (startYear: number) => ReactNode }) {
  const settings = useSettings();
  if (!settings.data) return <p className="text-sm text-zinc-500">{copy.calendar.loading}</p>;
  return render(
    periodStartYearContaining(toWorkDate(new Date(), APP_TIME_ZONE), settings.data.yearStart),
  );
}

type CalendarDialog =
  | { kind: 'request' | 'declare'; date: string; half?: Half }
  | { kind: 'cancel'; declared: CalendarHalfDay };

function CancelDeclaredDialog({
  declared,
  label,
  onClose,
}: {
  declared: CalendarHalfDay;
  label: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancel = useCancelLeaveRequest(declared.leaveRequestId);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  // The payload has no request range: the question names the type and the clicked day.
  const question = `${copy.calendar.cancelQuestionPrefix} ${label} ${copy.calendar.cancelQuestionMiddle} ${formatDayMonth(declared.date)} ?`;
  return (
    <dialog
      ref={dialogRef}
      aria-label={question}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-800">{question}</p>
        <ErrorBanner message={bannerMessageFor(cancel.error, [])} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.leaveRequests.keep}
          </Button>
          <Button
            onClick={() => cancel.mutate(undefined, { onSuccess: onClose })}
            isPending={cancel.isPending}
          >
            {copy.leaveRequests.confirmCancel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function YearCalendarView({
  ownerId,
  pathUserId,
  viewerId,
  startYear,
}: {
  ownerId: number;
  pathUserId: number | undefined;
  viewerId: number;
  startYear: number;
}) {
  const navigate = useNavigate();
  const calendar = useYearCalendar(ownerId, startYear);
  const dayTypes = useDayTypes();
  const data = calendar.data;
  const halfDaysByKey = useMemo(
    () => new Map(data?.halfDays.map((half) => [halfKey(half.date, half.half), half])),
    [data],
  );
  const holidaysByDate = useMemo(
    () => new Map(data?.holidays.map((holiday) => [holiday.date, holiday.label])),
    [data],
  );
  const [dialog, setDialog] = useState<CalendarDialog | null>(null);
  const isOwn = ownerId === viewerId;
  const canDeclare = data?.canDeclare ?? false;
  // Who may act on a half: yourself from today on (free workable halves), a manager on anyone's.
  const halfAction: HalfAction | undefined = data
    ? (date, half, declared) => {
        if (declared) {
          return canDeclare ? () => setDialog({ kind: 'cancel', declared }) : undefined;
        }
        if (isWeekendDate(date) || holidaysByDate.has(date)) return undefined;
        if (canDeclare) return () => setDialog({ kind: 'declare', date, half });
        return isOwn && date >= data.today
          ? () => setDialog({ kind: 'request', date, half })
          : undefined;
      }
    : undefined;
  const goTo = (year: number) => void navigate(calendarPath(pathUserId, year));

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">
        {data && ownerId !== viewerId
          ? `${copy.calendar.titleOf} ${data.user.firstName} ${data.user.lastName}`
          : copy.calendar.title}
      </h1>
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={copy.calendar.previousPeriod}
            disabled={startYear <= HOLIDAY_YEAR_MIN}
            onClick={() => goTo(startYear - 1)}
            className="rounded-lg p-2 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <p className="min-w-40 text-center text-base font-semibold">
            {data ? periodLabel(data.period.startDate, data.period.endDate) : startYear}
          </p>
          <button
            type="button"
            aria-label={copy.calendar.nextPeriod}
            disabled={startYear >= HOLIDAY_YEAR_MAX}
            onClick={() => goTo(startYear + 1)}
            className="rounded-lg p-2 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        <PersonPicker
          viewerId={viewerId}
          pathFor={(userId) => calendarPath(userId, startYear)}
          label={copy.calendar.viewCalendarOf}
        />
        {data && isOwn ? (
          <Button onClick={() => setDialog({ kind: 'request', date: data.today })}>
            {copy.leave.requestButton}
          </Button>
        ) : null}
        {data && canDeclare ? (
          <Button onClick={() => setDialog({ kind: 'declare', date: data.today })}>
            {`${copy.calendar.declareFor} ${data.user.firstName}`}
          </Button>
        ) : null}
      </div>
      {calendar.isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.calendar.loadError}
        </p>
      ) : null}
      {calendar.isPending ? <p className="text-sm text-zinc-500">{copy.calendar.loading}</p> : null}
      {data ? (
        <div className="grid gap-4 motion-safe:animate-[week-in_200ms_ease-out] lg:grid-cols-[1fr_16rem]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthsOfPeriod(data.period).map(({ year, month }) => (
              <MonthCard
                key={`${year}-${month}`}
                year={year}
                month={month}
                period={data.period}
                halfDaysByKey={halfDaysByKey}
                holidaysByDate={holidaysByDate}
                dayTypes={dayTypes.data ?? []}
                today={data.today}
                halfAction={halfAction}
              />
            ))}
          </div>
          <UsageSummaryPanel calendar={data} dayTypes={dayTypes.data ?? []} />
        </div>
      ) : null}
      {data && dialog?.kind === 'cancel' ? (
        <CancelDeclaredDialog
          declared={dialog.declared}
          label={
            dayTypes.data?.find((type) => type.code === dialog.declared.dayTypeCode)?.label ??
            dialog.declared.dayTypeCode
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {data && dialog && dialog.kind !== 'cancel' ? (
        <LeaveRequestDialog
          initialDate={dialog.date}
          initialHalf={dialog.half}
          {...(dialog.kind === 'request' ? { minDate: data.today } : { targetUser: data.user })}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
