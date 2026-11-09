import type { AnswerClockCorrectionRequest, ClockCorrectionView } from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { notify } from '../notifications/notify';
import {
  ClockCorrectionAnswerForbiddenError,
  ClockCorrectionNotFoundError,
  ClockCorrectionNotPendingError,
} from './correction-errors';
import { answerPendingCorrection, findClockCorrectionById } from './correction-repository';
import { toClockCorrectionView } from './correction-view';
import { findVisibleCorrection } from './read-corrections';

export async function answerClockCorrection(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; correctionId: number } & AnswerClockCorrectionRequest,
): Promise<ClockCorrectionView> {
  const visible = await findVisibleCorrection(deps, command);
  if (visible.user.id !== command.viewer.id) throw new ClockCorrectionAnswerForbiddenError();
  const respondedAt = deps.now();
  await deps.db.transaction().execute(async (trx) => {
    const isAnswered = await answerPendingCorrection(trx, {
      correctionId: command.correctionId,
      status: command.status,
      responseComment: command.responseComment || null,
      respondedAt,
    });
    if (!isAnswered) throw new ClockCorrectionNotPendingError();
    await notify(trx, {
      userId: visible.author.id,
      type: 'clock_correction_answered',
      payload: {
        correctionId: visible.id,
        ownerId: visible.user.id,
        workDate: visible.workDate,
        actorName: `${visible.user.firstName} ${visible.user.lastName}`,
        status: command.status,
      },
    });
  });
  const answered = await findClockCorrectionById(deps.db, command.correctionId);
  if (!answered) throw new ClockCorrectionNotFoundError();
  return toClockCorrectionView(answered, command.viewer.id);
}
