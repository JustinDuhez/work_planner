import type { TeamView } from '@work-planner/domain';
import { useEffect, useRef } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { ErrorBanner } from '../directory/manage-user-dialog';
import { Button } from '../ui/button';
import { useDeleteTeam } from './team-mutations';

export function DeleteTeamDialog({ team, onClose }: { team: TeamView; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const remove = useDeleteTeam(team.id);
  const { confirmDeletePrefix, confirmDeleteMiddle, confirmDeleteSuffix } = copy.teamDialog;
  const count = team.members.length;
  const question = `${confirmDeletePrefix} ${team.name} `;
  let sentence = `${question}${confirmDeleteMiddle} ${count} ${confirmDeleteSuffix}`;
  if (count === 0) sentence = question + copy.teamDialog.confirmDeleteNone;
  if (count === 1) sentence = question + copy.teamDialog.confirmDeleteSingle;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.teamDialog.deleteTitle}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <div className="space-y-4">
        <h2 className="text-base font-semibold">{copy.teamDialog.deleteTitle}</h2>
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
    </dialog>
  );
}
