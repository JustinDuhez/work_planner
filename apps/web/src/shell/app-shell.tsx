import { Link, Outlet } from 'react-router';
import { copy } from '../copy';
import { UserMenu } from './user-menu';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            {copy.appName}
          </Link>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
