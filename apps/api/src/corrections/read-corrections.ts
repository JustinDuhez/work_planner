import {
  canEditPastClock,
  type ClockCorrectionStatus,
  type ClockCorrectionView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
import {
  ClockCorrectionNotFoundError,
  ClockCorrectionsViewForbiddenError,
} from './correction-errors';
import { findClockCorrectionById, findClockCorrections } from './correction-repository';
import { toClockCorrectionView } from './correction-view';

/** The person, the author, and whoever may correct that person's days (E1 scope). */
async function canViewCorrectionsOf(viewer: ClockViewer, ownerId: number): Promise<boolean> {
  return viewer.id === ownerId || canEditPastClock(await viewer.loadActor(), ownerId);
}

export async function findVisibleCorrection(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; correctionId: number },
): Promise<ClockCorrectionView> {
  const correction = await findClockCorrectionById(deps.db, query.correctionId);
  const isVisible =
    correction !== undefined &&
    (correction.author.id === query.viewer.id ||
      (await canViewCorrectionsOf(query.viewer, correction.user.id)));
  // Not visible = not found: no hint that the correction exists.
  if (!correction || !isVisible) throw new ClockCorrectionNotFoundError();
  return toClockCorrectionView(correction, query.viewer.id);
}

export async function listClockCorrections(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; ownerId: number; status?: ClockCorrectionStatus },
): Promise<ClockCorrectionView[]> {
  const owner = await findActiveUserSummary(deps.db, query.ownerId);
  if (!owner) throw new UserNotFoundError();
  if (!(await canViewCorrectionsOf(query.viewer, owner.id)))
    throw new ClockCorrectionsViewForbiddenError();
  const corrections = await findClockCorrections(deps.db, {
    userId: owner.id,
    status: query.status,
  });
  return corrections.map((correction) => toClockCorrectionView(correction, query.viewer.id));
}
