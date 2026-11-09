import {
  formatMinutes,
  formatSignedMinutes,
  toLocalTime,
  type ClockCorrectionView,
} from '@work-planner/domain';
import { useEffect, useRef, useState } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useAnswerClockCorrection, useClockCorrection } from './correction-queries';

type CorrectionDay = ClockCorrectionView['before'];

function periodLabel(period: CorrectionDay['periods'][number]): string {
  const start = toLocalTime(new Date(period.startedAt), APP_TIME_ZONE);
  const end = period.endedAt === null ? '…' : toLocalTime(new Date(period.endedAt), APP_TIME_ZONE);
  return `${start} – ${end}`;
}

function workModeLabel(workMode: CorrectionDay['workMode']): string {
  if (workMode === 'telework') return copy.clock.telework;
  return workMode === 'on_site' ? copy.clock.onSite : '—';
}

function DayColumn({ title, day }: { title: string; day: CorrectionDay }) {
  return (
    <section className="flex-1 rounded-lg border border-zinc-200 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">{workModeLabel(day.workMode)}</p>
      <ul className="mt-2 space-y-1 text-sm tabular-nums">
        {day.periods.length === 0 ? (
          <li className="text-zinc-500">{copy.corrections.noPeriod}</li>
        ) : null}
        {day.periods.map((period) => (
          <li key={period.startedAt}>{periodLabel(period)}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-semibold tabular-nums">{formatMinutes(day.workedMinutes)}</p>
    </section>
  );
}

export function CorrectionDetailDialog({
  correctionId,
  ownerId,
  onClose,
}: {
  correctionId: number;
  ownerId: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const correction = useClockCorrection(correctionId);
  const answer = useAnswerClockCorrection(ownerId);
  const [isRefusing, setIsRefusing] = useState(false);
  const [responseComment, setResponseComment] = useState('');
  const bannerMessage = bannerMessageFor(answer.error, []);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function send(status: 'accepted' | 'refused') {
    const comment = responseComment.trim();
    // The answer is final: closing is simpler than showing a read-only copy of what was just sent.
    answer.mutate(
      {
        correctionId,
        status,
        ...(status === 'refused' && comment !== '' ? { responseComment: comment } : {}),
      },
      { onSuccess: onClose },
    );
  }

  const view = correction.data;
  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.corrections.detailTitle}
      onClose={onClose}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <h2 className="text-base font-semibold">{copy.corrections.detailTitle}</h2>
      {correction.isError ? (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {copy.corrections.loadError}
        </p>
      ) : null}
      {view ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-600">
            {`${formatLongDate(view.workDate)} · ${view.author.firstName} ${view.author.lastName}`}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <DayColumn title={copy.corrections.beforeTitle} day={view.before} />
            <DayColumn title={copy.corrections.afterTitle} day={view.after} />
          </div>
          <p className="text-sm">
            {copy.corrections.difference}{' '}
            <span className="font-semibold tabular-nums">
              {formatSignedMinutes(view.differenceMinutes)}
            </span>
          </p>
          {view.comment ? (
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{view.comment}</p>
          ) : null}
          {view.responseComment ? (
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {`${copy.corrections.responseCommentLabel} : ${view.responseComment}`}
            </p>
          ) : null}
          {view.canAnswer && isRefusing ? (
            <label className="block space-y-1 text-sm font-medium">
              <span>{copy.corrections.refusalComment}</span>
              <textarea
                value={responseComment}
                onChange={(event) => setResponseComment(event.target.value)}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {bannerMessage ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {bannerMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {copy.corrections.close}
        </Button>
        {view?.canAnswer && !isRefusing ? (
          <>
            <Button variant="secondary" onClick={() => setIsRefusing(true)}>
              {copy.corrections.refuse}
            </Button>
            <Button isPending={answer.isPending} onClick={() => send('accepted')}>
              {copy.corrections.accept}
            </Button>
          </>
        ) : null}
        {view?.canAnswer && isRefusing ? (
          <Button isPending={answer.isPending} onClick={() => send('refused')}>
            {copy.corrections.confirmRefusal}
          </Button>
        ) : null}
      </div>
    </dialog>
  );
}
