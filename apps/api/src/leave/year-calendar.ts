import {
  canDeclareLeaveFor,
  summarizeLeaveUsage,
  toWorkDate,
  yearPeriodOf,
  type YearCalendar,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { findPublicHolidays } from '../holidays/holiday-repository';
import { readSettings } from '../settings/settings-repository';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
import { findCalendarHalfDays, findDayTypes } from './leave-repository';

/** E6b-D2: anyone may read anyone's calendar; only types and statuses travel, never reasons. */
export async function buildYearCalendar(
  deps: ClockDependencies,
  query: { viewer: ClockViewer; userId: number; startYear: number },
): Promise<YearCalendar> {
  const user = await findActiveUserSummary(deps.db, query.userId);
  if (!user) throw new UserNotFoundError();
  const { yearStart } = await readSettings(deps.db);
  const period = yearPeriodOf(query.startYear, yearStart);
  const range = { fromDate: period.startDate, toDate: period.endDate };
  const [halfDays, holidays, dayTypes, actor] = await Promise.all([
    findCalendarHalfDays(deps.db, { userId: user.id, ...range }),
    findPublicHolidays(deps.db, range),
    findDayTypes(deps.db),
    query.viewer.loadActor(),
  ]);
  return {
    user,
    period,
    halfDays,
    holidays,
    summary: summarizeLeaveUsage(
      halfDays,
      dayTypes.map((type) => type.code),
    ),
    holidayCount: holidays.length,
    canDeclare: canDeclareLeaveFor(actor, user.id),
    today: toWorkDate(deps.now(), deps.timeZone),
  };
}
