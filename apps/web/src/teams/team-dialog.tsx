import { isInSubtree, type TeamView } from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { useDirectory } from '../directory/directory-queries';
import { ErrorBanner, fieldErrorsOf } from '../directory/manage-user-dialog';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { useCreateTeam, useUpdateTeam } from './team-mutations';

const RENDERED_FIELDS = ['name', 'parentTeamId', 'managerId', 'memberIds'];
const NO_TEAM_ID = 0;
const SELECT_CLASS = 'h-10 w-full rounded-lg border border-zinc-200 px-2';

function toOptionalId(value: string): number | null {
  return value === '' ? null : Number(value);
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

export function TeamDialog({
  team,
  teams,
  onClose,
}: {
  team: TeamView | null;
  teams: readonly TeamView[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const people = useDirectory(false);
  const [name, setName] = useState(team?.name ?? '');
  const [parentTeamId, setParentTeamId] = useState(team?.parentTeamId?.toString() ?? '');
  const [managerId, setManagerId] = useState(team?.manager?.id.toString() ?? '');
  const [memberIds, setMemberIds] = useState<ReadonlySet<number>>(
    new Set(team?.members.map((member) => member.id)),
  );
  const [filter, setFilter] = useState('');
  const create = useCreateTeam();
  const update = useUpdateTeam(team?.id ?? NO_TEAM_ID);
  const mutation = team ? update : create;
  const fieldErrors: Record<string, string | undefined> = fieldErrorsOf(mutation.error);
  // A team can never sit under itself or one of its sub-teams (the server checks it too).
  const parentOptions = teams.filter(
    (candidate) => !team || !isInSubtree(teams, team.id, candidate.id),
  );
  const needle = filter.trim().toLocaleLowerCase('fr-FR');
  const visiblePeople = (people.data ?? []).filter((person) =>
    fullName(person).toLocaleLowerCase('fr-FR').includes(needle),
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function toggleMember(personId: number) {
    setMemberIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      name,
      parentTeamId: toOptionalId(parentTeamId),
      managerId: toOptionalId(managerId),
      memberIds: [...memberIds].sort((first, second) => first - second),
    };
    if (team) update.mutate(body, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  }

  const title = team ? copy.teamDialog.editTitle : copy.teamDialog.createTitle;
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{title}</h2>
        <TextField
          label={copy.teamDialog.name}
          name="name"
          value={name}
          onChange={setName}
          error={fieldErrors.name}
        />
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.teamDialog.parent}</span>
          <select
            value={parentTeamId}
            onChange={(event) => setParentTeamId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">{copy.teamDialog.noParent}</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          {fieldErrors.parentTeamId ? (
            <span className="text-xs text-rose-700">{fieldErrors.parentTeamId}</span>
          ) : null}
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.teamDialog.manager}</span>
          <select
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">{copy.teamDialog.noManager}</option>
            {(people.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </select>
          {fieldErrors.managerId ? (
            <span className="text-xs text-rose-700">{fieldErrors.managerId}</span>
          ) : null}
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{`${copy.teamDialog.members} · ${memberIds.size} ${memberIds.size > 1 ? copy.teamDialog.selectedMany : copy.teamDialog.selectedOne}`}</legend>
          <input
            type="search"
            aria-label={copy.teamDialog.memberFilter}
            placeholder={copy.teamDialog.memberFilter}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {visiblePeople.map((person) => (
              <li key={person.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={memberIds.has(person.id)}
                    onChange={() => toggleMember(person.id)}
                  />
                  {fullName(person)}
                </label>
              </li>
            ))}
          </ul>
          {fieldErrors.memberIds ? (
            <span className="text-xs text-rose-700">{fieldErrors.memberIds}</span>
          ) : null}
        </fieldset>
        <ErrorBanner message={bannerMessageFor(mutation.error, RENDERED_FIELDS)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.teamDialog.cancel}
          </Button>
          <Button type="submit" isPending={mutation.isPending}>
            {copy.teamDialog.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
