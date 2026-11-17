import { Link, NavLink, Outlet } from 'react-router';
import { copy } from '../copy';
import { HealthStatus } from '../health/health-status';
import { NotificationBell } from '../notifications/notification-bell';
import { MAIN_ID, NAV_ITEMS } from './nav-items';
import { PhoneMenu } from './phone-menu';
import { UserMenu } from './user-menu';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased">
      <a
        href={`#${MAIN_ID}`}
        onClick={(event) => {
          // Move focus too: the hash alone scrolls but does not always focus the target.
          event.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
        className="sr-only rounded-control bg-white px-3 py-2 text-sm font-medium text-primary-700 shadow-popover focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-30"
      >
        {copy.shell.skipToContent}
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            {copy.appName}
          </Link>
          <nav aria-label={copy.shell.mainNav} className="hidden items-center gap-5 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'isEnd' in item}
                className={({ isActive }) =>
                  `border-b-2 py-1 text-sm ${isActive ? 'border-primary-600 font-semibold text-primary-700' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <PhoneMenu />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-10"
      >
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-6xl justify-end px-4 pb-6 sm:px-6">
        <HealthStatus />
      </footer>
    </div>
  );
}
