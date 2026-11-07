import { Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { copy } from '../copy';
import { clockWeekPath } from './clock-time';
import { useActiveUsers } from './clock-queries';

const PICKER_ID = 'person-picker';

function closePicker(): void {
  document.getElementById(PICKER_ID)?.hidePopover?.();
}

export function PersonPicker({ viewerId, isoWeek }: { viewerId: number; isoWeek: string }) {
  const [search, setSearch] = useState('');
  const users = useActiveUsers();
  const normalizedSearch = search.trim().toLocaleLowerCase('fr-FR');
  const matches = (users.data ?? [])
    .filter((user) =>
      `${user.firstName} ${user.lastName}`.toLocaleLowerCase('fr-FR').includes(normalizedSearch),
    )
    .sort((first, second) => Number(second.id === viewerId) - Number(first.id === viewerId));

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget={PICKER_ID}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        <Users size={16} aria-hidden /> {copy.clock.viewWeekOf}
      </button>
      <div
        id={PICKER_ID}
        popover="auto"
        className="m-0 mt-2 w-72 rounded-card border border-zinc-200 bg-white p-2 shadow-card [inset:unset] [position-area:bottom_span-left]"
      >
        <input
          type="search"
          aria-label={copy.clock.searchPerson}
          placeholder={copy.clock.searchPerson}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-primary-500"
        />
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {matches.map((user) => (
            <li key={user.id}>
              <Link
                to={clockWeekPath(user.id === viewerId ? undefined : user.id, isoWeek)}
                onClick={closePicker}
                className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                {user.firstName} {user.lastName} {user.id === viewerId ? copy.clock.you : null}
              </Link>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">{copy.clock.noPersonFound}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
