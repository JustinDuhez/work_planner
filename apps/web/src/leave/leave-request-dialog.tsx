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
import { fieldErrorsOf } from '../directory/manage-user-dialog';
import { ErrorBanner } from '../ui/error-banner';
import { usePublicHolidays } from '../settings/settings-queries';
import { Button } from '../ui/button';
import { StatusMessage } from '../ui/status-message';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
import { TextField } from '../ui/text-field';
import { useCreateLeaveRequest, useDayTypes, useDeclareLeaveRequest } from './leave-queries';

const EARLY_DEPARTURE = 'early_departure';
const RENDERED_FIELDS = ['dayTypeCode', 'startDate', 'endDate', 'reason'];
const EARLY_DEPARTURE_RENDERED_FIELDS = ['dayTypeCode', 'startDate', 'reason'];
const SELECT_CLASS = 'h-10 w-full rounded-control border border-line px-2';

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
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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
  const [failedChecks, setFailedChecks] = useState(0);
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

  // The focused submit button leaves with the success: the Close button takes the focus over.
  useEffect(() => {
    if (create.isSuccess) closeRef.current?.focus();
  }, [create.isSuccess]);
  useFocusFirstInvalid(formRef, create.error);
  useFocusFirstInvalid(formRef, failedChecks);

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
      setFailedChecks((count) => count + 1);
      return;
    }
    setTypeError(undefined);
    if (isEarlyDeparture && reason.trim() === '') {
      setReasonError(copy.leave.reasonRequired);
      setFailedChecks((count) => count + 1);
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
    <Dialog title={dialogTitle} onClose={onClose} widthClass="w-[min(30rem,calc(100vw-2rem))]">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label={copy.leave.type} error={fieldErrors.dayTypeCode}>
          {(control) => (
            <select
              {...control}
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
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.leave.startDate} error={fieldErrors.startDate}>
            {(control) => (
              <input
                {...control}
                type="date"
                value={startDate}
                min={minDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (event.target.value > endDate) setEndDate(event.target.value);
                }}
                className="h-10 w-full rounded-control border border-line px-3"
              />
            )}
          </Field>
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
              <Field label={copy.leave.endDate} error={fieldErrors.endDate}>
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-10 w-full rounded-control border border-line px-3"
                  />
                )}
              </Field>
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
            onChange={(value) => {
              setReason(value);
              setReasonError(undefined);
            }}
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
        <StatusMessage
          message={create.data ? outcomeMessage(create.data, targetUser !== undefined) : null}
          tone="success"
        />
        <div className="flex justify-end gap-2">
          <Button ref={closeRef} variant="secondary" onClick={onClose}>
            {create.data ? copy.leave.close : copy.leave.cancel}
          </Button>
          {create.data ? null : (
            <Button type="submit" isPending={create.isPending}>
              {targetUser ? copy.leave.declare : copy.leave.submit}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
