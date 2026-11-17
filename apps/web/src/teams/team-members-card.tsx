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
  return (
    <SummaryCard title={team.name}>
      <ul className="space-y-2 text-sm">
        {manager ? (
          <li className="flex items-center gap-2">
            <Avatar firstName={manager.firstName} lastName={manager.lastName} />
            <span className="font-medium text-zinc-900">{`${manager.firstName} ${manager.lastName}`}</span>
            <span className="text-xs font-medium text-zinc-500">{copy.teams.managerTag}</span>
          </li>
        ) : null}
        {team.members.map((member) => (
          <li key={member.id} className="flex items-center gap-2">
            <Avatar firstName={member.firstName} lastName={member.lastName} />
            <Link
              to={clockWeekPath(member.id === ownUserId ? undefined : member.id, isoWeek)}
              className="text-zinc-800 hover:text-primary-600"
            >
              {`${member.firstName} ${member.lastName}`}
            </Link>
          </li>
        ))}
      </ul>
      {team.members.length === 0 ? (
        <p className="text-sm text-zinc-600">{copy.teams.noMembers}</p>
      ) : null}
    </SummaryCard>
  );
}
