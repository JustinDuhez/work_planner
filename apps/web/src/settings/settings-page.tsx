import {
  HOLIDAY_YEAR_MAX,
  HOLIDAY_YEAR_MIN,
  toWorkDate,
  type PublicHoliday,
} from '@work-planner/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { ErrorBanner, fieldErrorsOf } from '../directory/manage-user-dialog';
import { NotFoundPage } from '../not-found/not-found-page';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import {
  useAddPublicHoliday,
  useImportPublicHolidays,
  usePublicHolidays,
  useRemovePublicHoliday,
  useSettings,
  useUpdateSettings,
} from './settings-queries';

const YEAR_PARAM = 'annee';
const MAX_DAY_OF_MONTH = 31;
const YEAR_BUTTON_CLASS =
  'flex size-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100';

function yearFromUrl(value: string | null): number {
  const year = Number(value);
  const isUsable = Number.isInteger(year) && year >= HOLIDAY_YEAR_MIN && year <= HOLIDAY_YEAR_MAX;
  return isUsable ? year : Number(toWorkDate(new Date(), APP_TIME_ZONE).slice(0, 4));
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function HolidayRow({ holiday }: { holiday: PublicHoliday }) {
  const remove = useRemovePublicHoliday();
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <li
      aria-label={`${formatLongDate(holiday.date)} ${holiday.label}`}
      className="flex flex-wrap items-center justify-between gap-2 py-2"
    >
      <span className="text-sm">
        <span className="tabular-nums text-zinc-500">{formatLongDate(holiday.date)}</span>{' '}
        <span className="text-zinc-900">{holiday.label}</span>
      </span>
      {isConfirming ? (
        <span className="flex gap-2">
          <Button onClick={() => remove.mutate(holiday.date)} isPending={remove.isPending}>
            {copy.settings.confirmDelete}
          </Button>
          <Button variant="secondary" onClick={() => setIsConfirming(false)}>
            {copy.settings.cancel}
          </Button>
        </span>
      ) : (
        <Button variant="ghost" onClick={() => setIsConfirming(true)}>
          {copy.settings.deleteHoliday}
        </Button>
      )}
      <ErrorBanner message={bannerMessageFor(remove.error, [])} />
    </li>
  );
}

function HolidaysSection({
  year,
  onYearChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
}) {
  const holidays = usePublicHolidays(year);
  const importHolidays = useImportPublicHolidays();
  const add = useAddPublicHoliday();
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const addErrors = fieldErrorsOf(add.error);

  function importedMessage(addedCount: number): string {
    if (addedCount === 0)
      return `${copy.settings.nothingImportedPrefix} ${year} ${copy.settings.nothingImportedSuffix}`;
    return addedCount === 1
      ? copy.settings.importedOne
      : `${addedCount} ${copy.settings.importedSuffix}`;
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    add.mutate(
      { date, label },
      {
        onSuccess: () => {
          setDate('');
          setLabel('');
        },
      },
    );
  }

  return (
    <section className="space-y-3 rounded-card border border-zinc-200 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{copy.settings.holidaysTitle}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={copy.settings.previousYear}
            disabled={year <= HOLIDAY_YEAR_MIN}
            onClick={() => onYearChange(year - 1)}
            className={YEAR_BUTTON_CLASS}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className="tabular-nums text-sm font-medium">{year}</span>
          <button
            type="button"
            aria-label={copy.settings.nextYear}
            disabled={year >= HOLIDAY_YEAR_MAX}
            onClick={() => onYearChange(year + 1)}
            className={YEAR_BUTTON_CLASS}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
      {holidays.data && holidays.data.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.settings.noHolidays}</p>
      ) : null}
      <ul className="divide-y divide-zinc-100">
        {(holidays.data ?? []).map((holiday) => (
          <HolidayRow key={holiday.date} holiday={holiday} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          isPending={importHolidays.isPending}
          onClick={() => importHolidays.mutate(year)}
        >
          {`${copy.settings.importPrefix} ${year}`}
        </Button>
        {importHolidays.data ? (
          <p role="status" className="text-sm text-emerald-700">
            {importedMessage(importHolidays.data.addedCount)}
          </p>
        ) : null}
        <ErrorBanner message={bannerMessageFor(importHolidays.error, [])} />
      </div>
      <form onSubmit={handleAdd} noValidate className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm font-medium">
          <span>{copy.settings.holidayDate}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-lg border border-zinc-200 px-3"
          />
          {addErrors.date ? (
            <span className="block text-xs text-rose-700">{addErrors.date}</span>
          ) : null}
        </label>
        <TextField
          label={copy.settings.holidayLabel}
          name="label"
          value={label}
          onChange={setLabel}
          error={addErrors.label}
        />
        <Button type="submit" isPending={add.isPending}>
          {copy.settings.addHoliday}
        </Button>
        <ErrorBanner message={bannerMessageFor(add.error, ['date', 'label'])} />
      </form>
    </section>
  );
}

function YearStartSection({ yearStart }: { yearStart: string }) {
  const update = useUpdateSettings();
  const [month, setMonth] = useState(yearStart.slice(0, 2));
  const [day, setDay] = useState(yearStart.slice(3, 5));
  const value = `${month}-${day}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate(value);
  }

  return (
    <section className="space-y-3 rounded-card border border-zinc-200 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold">{copy.settings.yearStartTitle}</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm font-medium">
          <span>{copy.settings.yearStartDay}</span>
          <select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="h-10 rounded-lg border border-zinc-200 px-2"
          >
            {Array.from({ length: MAX_DAY_OF_MONTH }, (_, index) => twoDigits(index + 1)).map(
              (option) => (
                <option key={option} value={option}>
                  {Number(option)}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{copy.settings.yearStartMonth}</span>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-10 rounded-lg border border-zinc-200 px-2"
          >
            {copy.settings.months.map((name, index) => (
              <option key={name} value={twoDigits(index + 1)}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" isPending={update.isPending}>
          {copy.settings.saveYearStart}
        </Button>
        {update.isSuccess ? (
          <p role="status" className="text-sm text-emerald-700">
            {copy.settings.saved}
          </p>
        ) : null}
      </form>
      <p className="text-sm text-zinc-500">{copy.settings.yearStartHint}</p>
      {/* The day list allows 31 for every month: "30 février" is refused with the server's message. */}
      <ErrorBanner
        message={fieldErrorsOf(update.error).yearStart ?? bannerMessageFor(update.error, [])}
      />
    </section>
  );
}

function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const settings = useSettings();
  const year = yearFromUrl(searchParams.get(YEAR_PARAM));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">{copy.settings.title}</h1>
      <HolidaysSection
        year={year}
        onYearChange={(nextYear) => setSearchParams({ [YEAR_PARAM]: String(nextYear) })}
      />
      {settings.data ? <YearStartSection yearStart={settings.data.yearStart} /> : null}
    </div>
  );
}

/** Admins only (E2b-D6); everyone else gets the not-found page and no settings request. */
export function SettingsPage() {
  const { data: session } = useSession();
  return session?.user.roles.isAdmin ? <AdminSettings /> : <NotFoundPage />;
}
