import {
  canEditPastClock,
  datesOfIsoWeek,
  dayWorkedMinutes,
  toWorkDate,
  ValidationError,
  type ClockDayView,
  type ClockWeek,
} from '@work-planner/domain';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
import type { ClockDependencies, ClockViewer } from './clock-dependencies';
import { findClockDays, toClockPeriodView } from './clock-repository';

const INVALID_WEEK_MESSAGE = 'Semaine invalide.';

export async function buildClockWeek(
  deps: ClockDependencies,
  query: { ownerId: number; isoWeek: string; viewer: ClockViewer },
): Promise<ClockWeek> {
  const dates = datesOfIsoWeek(query.isoWeek);
  const [monday] = dates ?? [];
  const sunday = dates?.[dates.length - 1];
  if (!dates || monday === undefined || sunday === undefined) {
    throw new ValidationError('VALIDATION_ERROR', 'Certains champs sont invalides.', {
      isoWeek: INVALID_WEEK_MESSAGE,
    });
  }
  const owner = await findActiveUserSummary(deps.db, query.ownerId);
  if (!owner) throw new UserNotFoundError();
  const now = deps.now();
  const today = toWorkDate(now, deps.timeZone);
  const storedDays = await findClockDays(deps.db, owner.id, monday, sunday);
  const isOwner = query.viewer.id === owner.id;
  const hasUnclosedDay = [...storedDays.values()].some(
    (day) => day.workDate < today && day.periods.some((period) => period.endedAt === null),
  );
  // Managers and admins may close someone else's unclosed day; load the actor only if needed.
  const canCloseForOwner =
    isOwner || (hasUnclosedDay && canEditPastClock(await query.viewer.loadActor(), owner.id));

  const days = dates.map((date): ClockDayView => {
    const stored = storedDays.get(date);
    const periods = stored?.periods ?? [];
    const isToday = date === today;
    const isUnclosed = date < today && periods.some((period) => period.endedAt === null);
    return {
      date,
      workMode: stored?.workMode ?? null,
      periods: periods.map(toClockPeriodView),
      workedMinutes: dayWorkedMinutes(periods, { now, isToday }),
      isToday,
      isFuture: date > today,
      isUnclosed,
      canEdit: isOwner && isToday,
      canClose: isUnclosed && canCloseForOwner,
    };
  });
  return {
    user: owner,
    isoWeek: query.isoWeek,
    serverNow: now.toISOString(),
    days,
    weekWorkedMinutes: days.reduce((totalMinutes, day) => totalMinutes + day.workedMinutes, 0),
  };
}
