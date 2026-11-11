import type { TeamView } from '@work-planner/domain';
import { useState } from 'react';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { DeleteTeamDialog } from './delete-team-dialog';
import { TeamDialog } from './team-dialog';
import { useTeams } from './team-queries';
import { TeamsPage } from './teams-page';

type OpenDialog =
  { kind: 'create' } | { kind: 'edit'; team: TeamView } | { kind: 'delete'; team: TeamView } | null;

export function TeamsAdminPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.roles.isAdmin ?? false;
  const teams = useTeams();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const close = () => setOpenDialog(null);

  return (
    <>
      <TeamsPage
        toolbar={
          isAdmin ? (
            <Button onClick={() => setOpenDialog({ kind: 'create' })}>
              {copy.teamDialog.newTeam}
            </Button>
          ) : undefined
        }
        teamActions={({ team, children }) =>
          team.canManage ? (
            <>
              <Button variant="secondary" onClick={() => setOpenDialog({ kind: 'edit', team })}>
                {copy.teamDialog.edit}
              </Button>
              <Button
                variant="secondary"
                isDisabled={children.length > 0}
                onClick={() => setOpenDialog({ kind: 'delete', team })}
              >
                {copy.teamDialog.delete}
              </Button>
              {children.length > 0 ? (
                <span className="text-xs text-zinc-500">{copy.teamDialog.hasSubteams}</span>
              ) : null}
            </>
          ) : null
        }
      />
      {openDialog?.kind === 'create' ? (
        <TeamDialog team={null} teams={teams.data ?? []} onClose={close} />
      ) : null}
      {openDialog?.kind === 'edit' ? (
        <TeamDialog
          key={openDialog.team.id}
          team={openDialog.team}
          teams={teams.data ?? []}
          onClose={close}
        />
      ) : null}
      {openDialog?.kind === 'delete' ? (
        <DeleteTeamDialog team={openDialog.team} onClose={close} />
      ) : null}
    </>
  );
}
