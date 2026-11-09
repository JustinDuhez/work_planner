import { datesOfIsoWeek } from '@work-planner/domain';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { CorrectionDetailDialog } from '../corrections/correction-detail-dialog';
import { CorrectionDialog } from '../corrections/correction-dialog';
import { CorrectionStatusChip } from '../corrections/correction-status-chip';
import { RefusedCorrectionsDialog } from '../corrections/refused-corrections-dialog';
import { NotFoundPage } from '../not-found/not-found-page';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { currentIsoWeek } from './clock-time';
import { useClockWeek } from './clock-queries';
import { CountersCard } from './counters-card';
import { CloseDayDialog } from './close-day-dialog';
import { DayRow } from './day-row';
import { CounterResetDialog } from './counter-reset-dialog';
import { CounterResetHistoryDialog } from './counter-reset-history-dialog';
import { PeriodDialog } from './period-dialog';
import { TodayControls } from './today-controls';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const correctionParam = Number(searchParams.get('correction'));
  const openCorrectionId =
    Number.isInteger(correctionParam) && correctionParam > 0 ? correctionParam : null;
  const week = useClockWeek(ownerId, isoWeek);
  const now = useServerClock(week.data?.serverNow);
  const isOwnWeek = ownerId === viewerId;
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
                  <>
                    {day.latestCorrection ? (
                      <CorrectionStatusChip
                        status={day.latestCorrection.status}
                        onOpen={() => openCorrection(day.latestCorrection!.id)}
                      />
                    ) : null}
                    {day.canEdit ? (
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
    </section>
  );
}
