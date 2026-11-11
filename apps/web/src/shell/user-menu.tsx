import { LogOut, Settings, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { copy } from '../copy';
import { initialsOf } from '../session/role-label';
import { useLogout, useSession } from '../session/session-queries';

const MENU_ID = 'user-menu';

function closeMenu(): void {
  // Native popover: closes on outside click by itself, but not when an item inside is used.
  document.getElementById(MENU_ID)?.hidePopover?.();
}

export function UserMenu() {
  const { data: session } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!session) return null;
  const { firstName, lastName, email } = session.user;

  function handleLogout() {
    closeMenu();
    logout.mutate(undefined, { onSettled: () => void navigate('/connexion', { replace: true }) });
  }

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget={MENU_ID}
        aria-label={copy.userMenu.open}
        className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
      >
        {initialsOf(firstName, lastName)}
      </button>
      <div
        id={MENU_ID}
        popover="auto"
        className="m-0 mt-2 w-60 rounded-card border border-zinc-200 bg-white p-1.5 shadow-card [inset:unset] [position-area:bottom_span-left]"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-zinc-900">
            {firstName} {lastName}
          </p>
          <p className="truncate text-xs text-zinc-500">{email}</p>
        </div>
        <Link
          to="/profil"
          onClick={closeMenu}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <UserRound size={16} aria-hidden /> {copy.userMenu.profile}
        </Link>
        {session.user.roles.isAdmin ? (
          <Link
            to="/parametres"
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Settings size={16} aria-hidden /> {copy.userMenu.settings}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <LogOut size={16} aria-hidden /> {copy.userMenu.logout}
        </button>
      </div>
    </div>
  );
}
