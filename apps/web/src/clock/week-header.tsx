import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { copy } from '../copy';
import {
  clockWeekPath,
  currentIsoWeek,
  shiftIsoWeek,
  weekNumberLabel,
  weekRangeLabel,
} from './clock-time';
import { PersonPicker } from './person-picker';

export function WeekHeader({
  isoWeek,
  pathUserId,
  viewerId,
}: {
  isoWeek: string;
  pathUserId: number | undefined;
  viewerId: number;
}) {
  const navigate = useNavigate();
  const goTo = (week: string) => void navigate(clockWeekPath(pathUserId, week));
  return (
    <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={copy.clock.previousWeek}
          onClick={() => goTo(shiftIsoWeek(isoWeek, -1))}
          className="rounded-lg p-2 hover:bg-zinc-100"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold">{weekNumberLabel(isoWeek)}</p>
          <p className="text-xs text-zinc-500">{weekRangeLabel(isoWeek)}</p>
        </div>
        <button
          type="button"
          aria-label={copy.clock.nextWeek}
          onClick={() => goTo(shiftIsoWeek(isoWeek, 1))}
          className="rounded-lg p-2 hover:bg-zinc-100"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => goTo(currentIsoWeek(new Date()))}
          className="ml-1 rounded-lg px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          {copy.clock.today}
        </button>
      </div>
      <PersonPicker viewerId={viewerId} isoWeek={isoWeek} />
    </div>
  );
}
