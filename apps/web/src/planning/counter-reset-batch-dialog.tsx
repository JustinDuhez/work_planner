import type { PlanningSection, TeamMonth } from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { useCreateCounterResets } from './planning-queries';

const checkboxClass = 'size-4 focus-visible:outline-2 focus-visible:outline-primary-600';

function SectionCheckbox({
  title,
  personIds,
  selected,
  onToggle,
}: {
  title: string;
  personIds: number[];
  selected: Set<number>;
  onToggle: (isChecked: boolean) => void;
}) {
  const boxRef = useRef<HTMLInputElement>(null);
  const selectedCount = personIds.filter((id) => selected.has(id)).length;
  const isAllSelected = selectedCount === personIds.length;

  useEffect(() => {
    // No HTML attribute exists for the mixed state.
    if (boxRef.current) boxRef.current.indeterminate = selectedCount > 0 && !isAllSelected;
  }, [selectedCount, isAllSelected]);

  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input
        ref={boxRef}
        type="checkbox"
        checked={isAllSelected}
        onChange={(event) => onToggle(event.target.checked)}
        className={checkboxClass}
      />
      {title}
    </label>
  );
}

export function CounterResetBatchDialog({
  teamMonth,
  sections,
  onClose,
  onDone,
}: {
  teamMonth: TeamMonth;
  sections: PlanningSection[];
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [resetDate, setResetDate] = useState(teamMonth.today);
  const createResets = useCreateCounterResets();
  const resettableSections = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => teamMonth.canResetUserIds.includes(row.personId)),
    }))
    .filter((section) => section.rows.length > 0);
  // Dialog order, each person once, even when listed under two teams.
  const orderedUserIds = [
    ...new Set(resettableSections.flatMap((section) => section.rows.map((row) => row.personId))),
  ].filter((id) => selected.has(id));
  const count = orderedUserIds.length;
  const fieldError =
    createResets.error instanceof ApiError ? createResets.error.fieldErrors.resetDate : undefined;
  const bannerMessage = bannerMessageFor(createResets.error, ['resetDate']);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function setPeople(ids: number[], isChecked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (isChecked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createResets.mutate(
      { userIds: orderedUserIds, resetDate },
      {
        onSuccess: () => {
          onDone(count);
          onClose();
        },
      },
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.planning.resetTitle}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(28rem,calc(100vw-2rem))] rounded-card border border-zinc-200 bg-white p-6 shadow-card backdrop:bg-zinc-900/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold">{copy.planning.resetTitle}</h2>
        <div className="max-h-[50dvh] space-y-3 overflow-y-auto">
          {resettableSections.map((section) => {
            const sectionIds = section.rows.map((row) => row.personId);
            return (
              <div key={section.teamId ?? 'none'} className="space-y-1">
                <SectionCheckbox
                  title={section.title}
                  personIds={sectionIds}
                  selected={selected}
                  onToggle={(isChecked) => setPeople(sectionIds, isChecked)}
                />
                {section.rows.map((row) => {
                  const person = teamMonth.people.find(
                    (candidate) => candidate.id === row.personId,
                  );
                  return (
                    <label key={row.personId} className="ml-6 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(row.personId)}
                        onChange={(event) => setPeople([row.personId], event.target.checked)}
                        className={checkboxClass}
                      />
                      {person ? `${person.firstName} ${person.lastName}` : ''}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
        <label className="block space-y-1 text-sm font-medium">
          <span>{copy.counters.resetDate}</span>
          <input
            type="date"
            value={resetDate}
            max={teamMonth.today}
            onChange={(event) => setResetDate(event.target.value)}
            aria-invalid={fieldError !== undefined}
            className="h-10 w-full rounded-lg border border-zinc-200 px-3 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          {fieldError ? <span className="text-xs text-rose-700">{fieldError}</span> : null}
        </label>
        {bannerMessage ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {bannerMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.counters.cancel}
          </Button>
          <Button type="submit" isPending={createResets.isPending} isDisabled={count === 0}>
            {`${copy.planning.resetSubmitPrefix} ${count} ${count === 1 ? copy.planning.counterSingular : copy.planning.counterPlural} ${copy.planning.resetSubmitSuffix}`}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
