import {
  expandWorkableHalfDays,
  formatDayCount,
  type Half,
  type LeaveRequestView,
  type UserSummary,
} from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { dayLabel } from '../clock/clock-time';
import { copy } from '../copy';
import { ErrorBanner, fieldErrorsOf } from '../directory/manage-user-dialog';
import { usePublicHolidays } from '../settings/settings-queries';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { useCreateLeaveRequest, useDayTypes, useDeclareLeaveRequest } from './leave-queries';

const EARLY_DEPARTURE = 'early_departure';
const RENDERED_FIELDS = ['dayTypeCode', 'startDate', 'endDate', 'reason'];
const EARLY_DEPARTURE_RENDERED_FIELDS = ['dayTypeCode', 'startDate', 'reason'];
const SELECT_CLASS = 'h-10 w-full rounded-lg border border-zinc-200 px-2';

function shortDay(date: string): string {
  const { weekday, dayOfMonth } = dayLabel(date);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
  return `${weekday.toLocaleLowerCase('fr-FR')}. ${dayOfMonth} ${month}`;
}

function outcomeMessage(request: LeaveRequestView, isDeclared: boolean): string {
  if (isDeclared) return copy.leave.declared;
  if (request.status === 'pending' && request.ruleNote)
    return `${copy.leave.needsApproval} ${request.ruleNote}`;
  if (request.status === 'approved') {
    return request.dayTypeCode === 'telework'
      ? copy.leave.teleworkApproved
      : copy.leave.autoApproved;
  }
  return copy.leave.sentToManager;
}

export function LeaveRequestDialog({
  initialDate,
  initialHalf,
  minDate,
  targetUser,
  onClose,
}: {
  initialDate: string;
  initialHalf?: Half;
  // Absent when declaring for someone: a manager may record a past absence.
  minDate?: string;
  targetUser?: UserSummary;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dayTypes = useDayTypes();
  const createOwn = useCreateLeaveRequest();
  // Both hooks run (rules of hooks); the declare one stays idle without a target.
  const declare = useDeclareLeaveRequest(targetUser?.id ?? 0);
  const create = targetUser ? declare : createOwn;
  const dialogTitle = targetUser
    ? `${copy.calendar.declareFor} ${targetUser.firstName} ${targetUser.lastName}`
    : copy.leave.dialogTitle;
  const [dayTypeCode, setDayTypeCode] = useState('');
  const [startDate, setStartDate] = useState(initialDate);
  const [startHalf, setStartHalf] = useState<Half>(initialHalf ?? 'am');
  const [endDate, setEndDate] = useState(initialDate);
  const [endHalf, setEndHalf] = useState<Half>(initialHalf ?? 'pm');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [typeError, setTypeError] = useState<string>();
  const isEarlyDeparture = dayTypeCode === EARLY_DEPARTURE;
  // An early departure is exactly one half-day (F6.3): the range collapses to the start half.
  const range = isEarlyDeparture
    ? { startDate, startHalf, endDate: startDate, endHalf: startHalf }
    : { startDate, startHalf, endDate, endHalf };

  function chooseDayType(code: string) {
    setDayTypeCode(code);
    setTypeError(undefined);
    // People usually leave early in the afternoon: start there, they can still pick the morning.
    if (code === EARLY_DEPARTURE) setStartHalf('pm');
  }
  // A range across two years only loads the start year holidays: summary only, the server decides.
  const holidays = usePublicHolidays(Number(range.startDate.slice(0, 4)));
  const holidayDates = new Set((holidays.data ?? []).map((holiday) => holiday.date));
  const slots = range.startDate && range.endDate ? expandWorkableHalfDays(range, holidayDates) : [];
  const fieldErrors: Record<string, string | undefined> = {
    ...fieldErrorsOf(create.error),
    ...(reasonError ? { reason: reasonError } : {}),
    ...(typeError ? { dayTypeCode: typeError } : {}),
  };

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function summary(): string {
    if (slots.length === 0) return copy.leave.emptyRange;
    const first = slots[0];
    const last = slots[slots.length - 1];
    if (!first || !last) return copy.leave.emptyRange;
    const isOneDay = first.date === last.date;
    const isWholeDays = first.half === 'am' && last.half === 'pm';
    if (isOneDay && isWholeDays) return `${formatDayCount(slots.length)} · ${shortDay(first.date)}`;
    const startText = `${shortDay(first.date)} ${first.half === 'am' ? copy.leave.halfMorning : copy.leave.noon}`;
    const endText = `${shortDay(last.date)} ${last.half === 'am' ? copy.leave.noon : copy.leave.evening}`;
    return `${formatDayCount(slots.length)} · ${copy.leave.from} ${startText} ${copy.leave.to} ${endText}`;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.reset();
    if (dayTypeCode === '') {
      setTypeError(copy.leave.typeRequired);
      return;
    }
    setTypeError(undefined);
    if (isEarlyDeparture && reason.trim() === '') {
      setReasonError(copy.leave.reasonRequired);
      return;
    }
    setReasonError(undefined);
    create.mutate({
      dayTypeCode,
      ...range,
      ...(isEarlyDeparture ? { reason: reason.trim() } : {}),
    });
  }

  const requestableTypes = (dayTypes.data ?? []).filter((type) => type.isRequestable);
  return (
    <dialog
      ref={dialogRef}
      aria-label={dialogTitle}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{dialogTitle}</h2>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.leave.type}</span>
          <select
            value={dayTypeCode}
            onChange={(event) => chooseDayType(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              {copy.leave.chooseType}
            </option>
            {requestableTypes.map((type) => (
              <option key={type.code} value={type.code}>
                {type.label}
              </option>
            ))}
          </select>
          {fieldErrors.dayTypeCode ? (
            <span className="block text-xs text-rose-700">{fieldErrors.dayTypeCode}</span>
          ) : null}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm font-medium">
            <span>{copy.leave.startDate}</span>
            <input
              type="date"
              value={startDate}
              min={minDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (event.target.value > endDate) setEndDate(event.target.value);
              }}
              className="h-10 w-full rounded-lg border border-zinc-200 px-3"
            />
            {fieldErrors.startDate ? (
              <span className="block text-xs text-rose-700">{fieldErrors.startDate}</span>
            ) : null}
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>{copy.leave.startHalf}</span>
            <select
              value={startHalf}
              onChange={(event) => setStartHalf(event.target.value as Half)}
              className={SELECT_CLASS}
            >
              <option value="am">{copy.leave.morning}</option>
              <option value="pm">{copy.leave.afternoon}</option>
            </select>
          </label>
          {isEarlyDeparture ? null : (
            <>
              <label className="space-y-1 text-sm font-medium">
                <span>{copy.leave.endDate}</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3"
                />
                {fieldErrors.endDate ? (
                  <span className="block text-xs text-rose-700">{fieldErrors.endDate}</span>
                ) : null}
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>{copy.leave.endHalf}</span>
                <select
                  value={endHalf}
                  onChange={(event) => setEndHalf(event.target.value as Half)}
                  className={SELECT_CLASS}
                >
                  <option value="am">{copy.leave.morning}</option>
                  <option value="pm">{copy.leave.afternoon}</option>
                </select>
              </label>
            </>
          )}
        </div>
        {isEarlyDeparture ? (
          <TextField
            label={copy.leave.reason}
            name="reason"
            value={reason}
            onChange={setReason}
            error={fieldErrors.reason}
          />
        ) : null}
        <p className="text-sm text-zinc-600">{summary()}</p>
        <ErrorBanner
          message={bannerMessageFor(
            create.error,
            isEarlyDeparture ? EARLY_DEPARTURE_RENDERED_FIELDS : RENDERED_FIELDS,
          )}
        />
        {create.data ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {outcomeMessage(create.data, targetUser !== undefined)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {create.data ? copy.leave.close : copy.leave.cancel}
          </Button>
          {create.data ? null : (
            <Button type="submit" isPending={create.isPending}>
              {targetUser ? copy.leave.declare : copy.leave.submit}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
