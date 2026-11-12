import { isoWeekOf, type NotificationView } from '@work-planner/domain';
import { clockWeekPath, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';

const LEAVE_INBOX_PATH = '/demandes?onglet=a-valider';
const OWN_REQUESTS_PATH = '/demandes?onglet=mes-demandes';

function correctionAction(type: NotificationView['type'], status?: string): string {
  if (type === 'clock_correction_received') return copy.notifications.correctedYourDay;
  return status === 'accepted'
    ? copy.notifications.acceptedYourCorrection
    : copy.notifications.refusedYourCorrection;
}

function leavePeriod(startDate: string, endDate: string): string {
  return startDate === endDate
    ? `${copy.notifications.onDate} ${formatLongDate(startDate)}`
    : `${copy.notifications.fromDate} ${formatLongDate(startDate)} ${copy.notifications.toDate} ${formatLongDate(endDate)}`;
}

export function notificationText(notification: NotificationView): string {
  const { payload } = notification;
  if (!('leaveRequestId' in payload)) {
    const { actorName, workDate, status } = payload;
    return `${actorName} ${correctionAction(notification.type, status)} ${formatLongDate(workDate)}`;
  }
  const { actorName, dayTypeLabel, startDate, endDate, decision } = payload;
  const action =
    notification.type === 'leave_request_received'
      ? copy.notifications.leaveRequested
      : notification.type === 'leave_request_cancelled'
        ? copy.notifications.leaveCancelled
        : decision === 'approved'
          ? copy.notifications.leaveApproved
          : copy.notifications.leaveRefused;
  return `${actorName} ${action} ${dayTypeLabel}, ${leavePeriod(startDate, endDate)}`;
}

export function notificationLink(notification: NotificationView, viewerId: number): string {
  const { payload } = notification;
  if ('leaveRequestId' in payload) {
    return notification.type === 'leave_request_reviewed' ? OWN_REQUESTS_PATH : LEAVE_INBOX_PATH;
  }
  // The corrected day's week, with the correction open (`?correction=`).
  const { ownerId, workDate, correctionId } = payload;
  const weekPath = clockWeekPath(ownerId === viewerId ? undefined : ownerId, isoWeekOf(workDate));
  return `${weekPath}&correction=${correctionId}`;
}
