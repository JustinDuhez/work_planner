import type { TeamView } from '@work-planner/domain';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { ErrorBanner } from '../ui/error-banner';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { useDeleteTeam } from './team-mutations';

export function DeleteTeamDialog({ team, onClose }: { team: TeamView; onClose: () => void }) {
  const remove = useDeleteTeam(team.id);
  const { confirmDeletePrefix, confirmDeleteMiddle, confirmDeleteSuffix } = copy.teamDialog;
  const count = team.members.length;
  const question = `${confirmDeletePrefix} ${team.name} `;
  let sentence = `${question}${confirmDeleteMiddle} ${count} ${confirmDeleteSuffix}`;
  if (count === 0) sentence = question + copy.teamDialog.confirmDeleteNone;
  if (count === 1) sentence = question + copy.teamDialog.confirmDeleteSingle;

  return (
    <Dialog
      title={copy.teamDialog.deleteTitle}
      onClose={onClose}
      widthClass="w-[min(26rem,calc(100vw-2rem))]"
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-700">{sentence}</p>
        <ErrorBanner message={bannerMessageFor(remove.error, [])} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.teamDialog.cancel}
          </Button>
          <Button
            isPending={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: onClose })}
          >
            {copy.teamDialog.confirmDelete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
