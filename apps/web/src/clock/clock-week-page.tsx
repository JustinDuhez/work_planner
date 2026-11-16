import { datesOfIsoWeek, toWorkDate, type ClockDayView } from '@work-planner/domain';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { CorrectionDetailDialog } from '../corrections/correction-detail-dialog';
import { CorrectionDialog } from '../corrections/correction-dialog';
import { CorrectionStatusChip } from '../corrections/correction-status-chip';
import { RefusedCorrectionsDialog } from '../corrections/refused-corrections-dialog';
import { NotFoundPage } from '../not-found/not-found-page';
import { HalfDayChips } from '../leave/half-day-chips';
import { LeaveRequestDialog } from '../leave/leave-request-dialog';
import { useDayTypes } from '../leave/leave-queries';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { LoadingRegion } from '../ui/skeleton';
import { APP_TIME_ZONE, currentIsoWeek } from './clock-time';
import { useClockWeek } from './clock-queries';
import { CountersCard } from './counters-card';
import { CloseDayDialog } from './close-day-dialog';
import { DayRow } from './day-row';
import { CounterResetDialog } from './counter-reset-dialog';
import { CounterResetHistoryDialog } from './counter-reset-history-dialog';
import { PeriodDialog } from './period-dialog';
import { TodayHero } from './today-hero';
import { useServerClock } from './use-server-clock';
import { WeekHeader } from './week-header';
import { WeekSkeleton } from './week-skeleton';

export function ClockWeekPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  // "This week" follows the live server clock across Sunday midnight; also kept current while a
  // week is asked for, so leaving `?semaine=` lands on the right week at once.
  const [followedWeek, setFollowedWeek] = useState(() => currentIsoWeek(new Date()));
  const { data: session } = useSession();
  if (!session) return null;
  const pathUserId = userId === undefined ? undefined : Number(userId);
  if (pathUserId !== undefined && !(Number.isInteger(pathUserId) && pathUserId > 0)) {
    return <NotFoundPage />;
  }
  const requestedWeek = searchParams.get('semaine');
  const isoWeek =
    requestedWeek !== null && datesOfIsoWeek(requestedWeek) ? requestedWeek : followedWeek;
  // The sticky bar stays outside the keyed view: rebuilt with each week, it would drop the focus
  // a keyboard user left on ‹ or ›.
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.clock.title}</h1>
      <WeekHeader isoWeek={isoWeek} pathUserId={pathUserId} viewerId={session.user.id} />
      <ClockWeekView
        key={`${pathUserId ?? 'me'}-${isoWeek}`}
        ownerId={pathUserId ?? session.user.id}
        viewerId={session.user.id}
        isoWeek={isoWeek}
        onTodayWeekChange={setFollowedWeek}
      />
    </section>
  );
}

function canDeclareAbsence(day: ClockDayView): boolean {
  const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const hasFreeHalf = day.halfDays.am === null || day.halfDays.pm === null;
  return (day.isToday || day.isFuture) && !isWeekend && day.holidayLabel === null && hasFreeHalf;
}

function ClockWeekView({
  ownerId,
  viewerId,
  isoWeek,
  onTodayWeekChange,
}: {
  ownerId: number;
  viewerId: number;
  isoWeek: string;
  onTodayWeekChange: (isoWeek: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const correctionParam = Number(searchParams.get('correction'));
  const openCorrectionId =
    Number.isInteger(correctionParam) && correctionParam > 0 ? correctionParam : null;
  const week = useClockWeek(ownerId, isoWeek);
  const now = useServerClock(week.data?.serverNow);
  // Re-checked every tick (`now`). Anchored on the answer, never on `now`: right after a remount
  // its offset is still 0, and a computer clock in another week would flip the page back and forth.
  useEffect(() => {
    if (!week.data) return;
    const serverNow = Date.parse(week.data.serverNow) + (Date.now() - week.dataUpdatedAt);
    onTodayWeekChange(currentIsoWeek(new Date(serverNow)));
  }, [onTodayWeekChange, now, week.data, week.dataUpdatedAt]);
  const isOwnWeek = ownerId === viewerId;
  const dayTypes = useDayTypes();
  const [leaveDialogDate, setLeaveDialogDate] = useState<string | null>(null);
  const serverToday = week.data ? toWorkDate(new Date(week.data.serverNow), APP_TIME_ZONE) : '';
  const requestDate = week.data
    ? ((week.data.days.find((day) => day.isToday) ?? week.data.days.find((day) => day.isFuture))
        ?.date ?? serverToday)
    : serverToday;
  const [dialog, setDialog] = useState<
    | { kind: 'add'; date: string }
    | { kind: 'edit'; date: string; periodId: number }
    | { kind: 'close'; date: string }
    | { kind: 'correct'; date: string }
    | null
  >(null);
  const [counterDialog, setCounterDialog] = useState<'reset' | 'history' | 'refused' | null>(null);
  function openCorrection(correctionId: number) {
    setSearchParams((params) => {
      params.set('correction', String(correctionId));
      return params;
    });
  }
  function closeCorrection() {
    setSearchParams((params) => {
      params.delete('correction');
      return params;
    });
  }
  const dialogDay = week.data?.days.find((day) => day.date === dialog?.date);
  // Only the owner can clock, and only today: any other week shows its counters and rows.
  const heroDay = week.data?.days.find((day) => day.isToday && day.canEdit);

  return (
    <div className="space-y-4">
      {/* A failed background refresh keeps the week on screen: the next poll or focus recovers. */}
      {week.isError && !week.data ? (
        <ErrorState message={copy.clock.loadError} onRetry={() => void week.refetch()} />
      ) : null}
      {week.isPending ? (
        <LoadingRegion label={copy.clock.loading}>
          <WeekSkeleton hasHero={isOwnWeek && isoWeek === currentIsoWeek(new Date())} />
        </LoadingRegion>
      ) : null}
      {week.data ? (
        <div className="space-y-4 motion-safe:animate-[week-in_200ms_ease-out]">
          {!isOwnWeek ? (
            <p className="rounded-control bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
              {copy.clock.readOnlyPrefix} {week.data.user.firstName} {week.data.user.lastName} —{' '}
              {copy.clock.readOnlySuffix}
            </p>
          ) : null}
          {heroDay ? (
            <TodayHero
              day={heroDay}
              now={now}
              ownerId={ownerId}
              isoWeek={isoWeek}
              onAddPeriod={() => setDialog({ kind: 'add', date: heroDay.date })}
              onRequestAbsence={() => setLeaveDialogDate(requestDate)}
            />
          ) : null}
          <CountersCard
            week={week.data}
            now={now}
            refusalAction={
              week.data.counters.canViewCorrections ? (
                <button
                  type="button"
                  onClick={() => setCounterDialog('refused')}
                  className="text-xs font-medium text-rose-700 hover:underline"
                >
                  {copy.corrections.refusedLink}
                </button>
              ) : undefined
            }
            actions={
              week.data.counters.canResetCounter ? (
                <>
                  <Button variant="secondary" onClick={() => setCounterDialog('reset')}>
                    {copy.counters.resetButton}
                  </Button>
                  <Button variant="ghost" onClick={() => setCounterDialog('history')}>
                    {copy.counters.historyButton}
                  </Button>
                </>
              ) : undefined
            }
          />
          {isOwnWeek && !heroDay ? (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setLeaveDialogDate(requestDate)}>
                {copy.leave.requestButton}
              </Button>
            </div>
          ) : null}
          <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
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
                  <>
                    <HalfDayChips halfDays={day.halfDays} dayTypes={dayTypes.data ?? []} />
                    {isOwnWeek && canDeclareAbsence(day) ? (
                      <button
                        type="button"
                        onClick={() => setLeaveDialogDate(day.date)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {copy.leave.declareDay}
                      </button>
                    ) : null}
                    {day.latestCorrection ? (
                      <CorrectionStatusChip
                        status={day.latestCorrection.status}
                        onOpen={() => openCorrection(day.latestCorrection!.id)}
                      />
                    ) : null}
                    {day.canEdit ? null : day.canClose ? (
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'close', date: day.date })}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {copy.clock.closeDay}
                      </button>
                    ) : day.canCorrect ? (
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'correct', date: day.date })}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {copy.corrections.correctDay}
                      </button>
                    ) : null}
                  </>
                }
              />
            ))}
          </ol>
        </div>
      ) : null}
      {dialog && dialogDay && (dialog.kind === 'add' || dialog.kind === 'edit') ? (
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
      {dialog?.kind === 'correct' && dialogDay ? (
        <CorrectionDialog day={dialogDay} ownerId={ownerId} onClose={() => setDialog(null)} />
      ) : null}
      {leaveDialogDate ? (
        <LeaveRequestDialog
          initialDate={leaveDialogDate}
          minDate={serverToday}
          onClose={() => setLeaveDialogDate(null)}
        />
      ) : null}
      {counterDialog === 'reset' && week.data ? (
        <CounterResetDialog week={week.data} onClose={() => setCounterDialog(null)} />
      ) : null}
      {counterDialog === 'history' ? (
        <CounterResetHistoryDialog ownerId={ownerId} onClose={() => setCounterDialog(null)} />
      ) : null}
      {counterDialog === 'refused' ? (
        <RefusedCorrectionsDialog
          ownerId={ownerId}
          onOpen={(correctionId) => {
            setCounterDialog(null);
            openCorrection(correctionId);
          }}
          onClose={() => setCounterDialog(null)}
        />
      ) : null}
      {openCorrectionId !== null ? (
        <CorrectionDetailDialog
          correctionId={openCorrectionId}
          ownerId={ownerId}
          onClose={closeCorrection}
        />
      ) : null}
    </div>
  );
}
