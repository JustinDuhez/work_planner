import {
  canDeclareLeaveFor,
  truncateToMinute,
  type CreateLeaveRequestRequest,
  type LeaveRequestView,
} from '@work-planner/domain';
import type { ClockDependencies, ClockViewer } from '../clock/clock-dependencies';
import { isUniqueViolation } from '../db/postgres-errors';
import { notify } from '../notifications/notify';
import { UserNotFoundError } from '../users/user-errors';
import { findActiveUserSummary } from '../users/user-repository';
import { insertLeaveRows, lockAndCheckOverlap, prepareLeaveRequest } from './leave-creation';
import {
  LeaveDeclareForbiddenError,
  LeaveDeclareSelfError,
  LeaveOverlapError,
} from './leave-errors';
import { findLeaveRequestById } from './leave-repository';
import { toLeaveRequestView } from './leave-view';

/** E6b-D4: a scope manager or admin records an absence, past included; it is decided by declaring. */
export async function declareLeaveRequest(
  deps: ClockDependencies,
  command: { viewer: ClockViewer; userId: number } & CreateLeaveRequestRequest,
): Promise<LeaveRequestView> {
  const { viewer, userId, ...request } = command;
  if (userId === viewer.id) throw new LeaveDeclareSelfError();
  const actor = await viewer.loadActor();
  const person = await findActiveUserSummary(deps.db, userId);
  if (!person) throw new UserNotFoundError();
  if (!canDeclareLeaveFor(actor, person.id)) throw new LeaveDeclareForbiddenError();
  const prepared = await prepareLeaveRequest(deps, request, { isDateFloorApplied: false });
  const declaredAt = truncateToMinute(deps.now());
  let requestId: number;
  try {
    requestId = await deps.db.transaction().execute(async (trx) => {
      await lockAndCheckOverlap(trx, { userId: person.id, prepared });
      const id = await insertLeaveRows(trx, {
        userId: person.id,
        authorId: viewer.id,
        prepared,
        status: 'approved',
        ruleNote: null,
        isAutoApproved: false,
        reviewerId: viewer.id,
        reviewedAt: declaredAt,
      });
      const declarer = await trx
        .selectFrom('appUser')
        .select(['firstName', 'lastName'])
        .where('id', '=', viewer.id)
        .executeTakeFirstOrThrow();
      await notify(trx, {
        userId: person.id,
        type: 'leave_request_declared',
        payload: {
          leaveRequestId: id,
          actorName: `${declarer.firstName} ${declarer.lastName}`,
          dayTypeLabel: prepared.dayType.label,
          startDate: request.startDate,
          endDate: request.endDate,
        },
      });
      return id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new LeaveOverlapError(prepared.firstSlot);
    throw error instanceof Error ? error : new Error('Unexpected database error', { cause: error });
  }
  const declared = await findLeaveRequestById(deps.db, requestId);
  if (!declared) throw new Error(`Leave request ${requestId} vanished`);
  return toLeaveRequestView(declared, { viewerId: viewer.id, actor, today: prepared.today });
}
