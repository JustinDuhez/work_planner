import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { notificationLink, notificationText } from './notification-text';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './notification-queries';

const PANEL_ID = 'notification-panel';
const MAX_BADGE_COUNT = 9;

function closePanel(): void {
  document.getElementById(PANEL_ID)?.hidePopover?.();
}

export function NotificationBell() {
  const { data: session } = useSession();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  if (!session) return null;
  const unreadCount = notifications.data?.unreadCount ?? 0;
  const label =
    unreadCount > 0 ? `${copy.notifications.bell} (${unreadCount})` : copy.notifications.bell;

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget={PANEL_ID}
        aria-label={label}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary-600 px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
          </span>
        ) : null}
      </button>
      <div
        id={PANEL_ID}
        popover="auto"
        className="m-0 mt-2 w-80 rounded-card border border-zinc-200 bg-white p-2 shadow-card [inset:unset] [position-area:bottom_span-left]"
      >
        {notifications.data?.notifications.length === 0 ? (
          <p className="px-3 py-2 text-sm text-zinc-500">{copy.notifications.empty}</p>
        ) : (
          <ul aria-label={copy.notifications.title} className="max-h-80 overflow-y-auto">
            {notifications.data?.notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  to={notificationLink(notification, session.user.id)}
                  onClick={() => {
                    closePanel();
                    if (notification.readAt === null) markRead.mutate(notification.id);
                  }}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 ${notification.readAt === null ? 'font-medium text-zinc-900' : 'text-zinc-500'}`}
                >
                  {notificationText(notification)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-primary-600 hover:bg-zinc-100"
          >
            {copy.notifications.markAllRead}
          </button>
        ) : null}
      </div>
    </div>
  );
}
