import { datesOfIsoWeek, formatMinutes } from '@work-planner/domain';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { NotFoundPage } from '../not-found/not-found-page';
import { useSession } from '../session/session-queries';
import { currentIsoWeek } from './clock-time';
import { useClockWeek } from './clock-queries';
import { CloseDayDialog } from './close-day-dialog';
import { DayRow } from './day-row';
import { PeriodDialog } from './period-dialog';
import { TodayControls } from './today-controls';
import { liveDayMinutes } from './live-minutes';
import { useServerClock } from './use-server-clock';
import { WeekHeader } from './week-header';

export function ClockWeekPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  if (!session) return null;
  const pathUserId = userId === undefined ? undefined : Number(userId);
  if (pathUserId !== undefined && !(Number.isInteger(pathUserId) && pathUserId > 0)) {
    return <NotFoundPage />;
  }
  const requestedWeek = searchParams.get('semaine');
  const isoWeek =
    requestedWeek !== null && datesOfIsoWeek(requestedWeek)
      ? requestedWeek
      : currentIsoWeek(new Date());
  return (
    <ClockWeekView
      key={`${pathUserId ?? 'me'}-${isoWeek}`}
      ownerId={pathUserId ?? session.user.id}
      pathUserId={pathUserId}
      viewerId={session.user.id}
      isoWeek={isoWeek}
    />
  );
}

function ClockWeekView({
  ownerId,
  pathUserId,
  viewerId,
  isoWeek,
}: {
  ownerId: number;
  pathUserId: number | undefined;
  viewerId: number;
  isoWeek: string;
}) {
  const week = useClockWeek(ownerId, isoWeek);
  const now = useServerClock(week.data?.serverNow);
  const isOwnWeek = ownerId === viewerId;
  const [dialog, setDialog] = useState<
    | { kind: 'add'; date: string }
    | { kind: 'edit'; date: string; periodId: number }
    | { kind: 'close'; date: string }
    | null
  >(null);
  const dialogDay = week.data?.days.find((day) => day.date === dialog?.date);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.clock.title}</h1>
      <WeekHeader isoWeek={isoWeek} pathUserId={pathUserId} viewerId={viewerId} />
      {week.isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.clock.loadError}
        </p>
      ) : null}
      {week.isPending ? <p className="text-sm text-zinc-500">{copy.clock.loading}</p> : null}
      {week.data ? (
        <div className="animate-[week-in_200ms_ease-out] space-y-3">
          {!isOwnWeek ? (
            <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
              {copy.clock.readOnlyPrefix} {week.data.user.firstName} {week.data.user.lastName} —{' '}
              {copy.clock.readOnlySuffix}
            </p>
          ) : null}
          <ol className="space-y-2">
            {week.data.days.map((day, index) => (
              <DayRow
                key={day.date}
                day={day}
                index={index}
                now={now}
                onSelectPeriod={
                  day.canEdit
                    ? (periodId) => setDialog({ kind: 'edit', date: day.date, periodId })
                    : undefined
                }
                actions={
                  day.canEdit ? (
                    <TodayControls
                      day={day}
                      ownerId={ownerId}
                      isoWeek={isoWeek}
                      onAddPeriod={() => setDialog({ kind: 'add', date: day.date })}
                    />
                  ) : day.canClose ? (
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'close', date: day.date })}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      {copy.clock.closeDay}
                    </button>
                  ) : null
                }
              />
            ))}
          </ol>
          <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-card">
            <p className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">{copy.clock.weekTotal}</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatMinutes(
                  week.data.days.reduce((total, day) => total + liveDayMinutes(day, now), 0),
                )}
              </span>
            </p>
          </div>
        </div>
      ) : null}
      {dialog && dialogDay && dialog.kind !== 'close' ? (
        <PeriodDialog
          period={
            dialog.kind === 'edit'
              ? dialogDay.periods.find((period) => period.id === dialog.periodId)
              : undefined
          }
          ownerId={ownerId}
          isoWeek={isoWeek}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'close' && dialogDay ? (
        <CloseDayDialog
          day={dialogDay}
          ownerId={ownerId}
          isoWeek={isoWeek}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
