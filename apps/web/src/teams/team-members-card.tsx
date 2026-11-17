import type { TeamView } from '@work-planner/domain';
import { Link } from 'react-router';
import { clockWeekPath } from '../clock/clock-time';
import { copy } from '../copy';
import { Avatar } from '../ui/avatar';
import { SummaryCard } from '../ui/summary-card';

export function TeamMembersCard({
  team,
  ownUserId,
  isoWeek,
}: {
  team: TeamView;
  ownUserId: number | undefined;
  isoWeek: string;
}) {
  const { manager } = team;
  // The manager is shown once, first and tagged, even when also a member.
  const people = [
    ...(manager ? [{ person: manager, isManager: true }] : []),
    ...team.members
      .filter((member) => member.id !== manager?.id)
      .map((person) => ({ person, isManager: false })),
  ];
  return (
    <SummaryCard title={team.name}>
      <ul className="space-y-2 text-sm">
        {people.map(({ person, isManager }) => (
          <li key={person.id} className="flex items-center gap-2">
            <Avatar firstName={person.firstName} lastName={person.lastName} />
            <Link
              to={clockWeekPath(person.id === ownUserId ? undefined : person.id, isoWeek)}
              className="text-zinc-800 hover:text-primary-600"
            >
              {`${person.firstName} ${person.lastName}`}
            </Link>
            {isManager ? (
              <span className="text-xs font-medium text-zinc-500">{copy.teams.managerTag}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {people.length === 0 ? <p className="text-sm text-zinc-600">{copy.teams.noMembers}</p> : null}
    </SummaryCard>
  );
}
