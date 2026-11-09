import { isoWeekOf, type NotificationView } from '@work-planner/domain';
import { clockWeekPath, formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';

function actionOf(notification: NotificationView): string {
  if (notification.type === 'clock_correction_received') return copy.notifications.correctedYourDay;
  return notification.payload.status === 'accepted'
    ? copy.notifications.acceptedYourCorrection
    : copy.notifications.refusedYourCorrection;
}

export function notificationText(notification: NotificationView): string {
  const { actorName, workDate } = notification.payload;
  return `${actorName} ${actionOf(notification)} ${formatLongDate(workDate)}`;
}

/** The corrected day's week, with the correction open (`?correction=`). */
export function notificationLink(notification: NotificationView, viewerId: number): string {
  const { ownerId, workDate, correctionId } = notification.payload;
  const weekPath = clockWeekPath(ownerId === viewerId ? undefined : ownerId, isoWeekOf(workDate));
  return `${weekPath}&correction=${correctionId}`;
}
