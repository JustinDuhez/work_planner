import { Link, NavLink, Outlet } from 'react-router';
import { copy } from '../copy';
import { HealthStatus } from '../health/health-status';
import { NotificationBell } from '../notifications/notification-bell';
import { UserMenu } from './user-menu';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            {copy.appName}
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`
              }
            >
              {copy.nav.clock}
            </NavLink>
            <NavLink
              to="/calendrier"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`
              }
            >
              {copy.nav.calendar}
            </NavLink>
            <NavLink
              to="/annuaire"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`
              }
            >
              {copy.nav.directory}
            </NavLink>
            <NavLink
              to="/equipes"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`
              }
            >
              {copy.nav.teams}
            </NavLink>
            <NavLink
              to="/demandes"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`
              }
            >
              {copy.nav.leave}
            </NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-6xl justify-end px-4 pb-24 sm:px-6 sm:pb-6">
        <HealthStatus />
      </footer>
    </div>
  );
}
