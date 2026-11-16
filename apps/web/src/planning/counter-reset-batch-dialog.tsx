import type { PlanningSection, TeamMonth } from '@work-planner/domain';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-client';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { ErrorBanner } from '../ui/error-banner';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { useFocusFirstInvalid } from '../ui/field-error';
import { useCreateCounterResets } from './planning-queries';

const checkboxClass = 'size-4';

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
  const formRef = useRef<HTMLFormElement>(null);
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

  useFocusFirstInvalid(formRef, createResets.error);

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
    <Dialog
      title={copy.planning.resetTitle}
      onClose={onClose}
      widthClass="w-[min(28rem,calc(100vw-2rem))]"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="max-h-[50dvh] space-y-3 overflow-y-auto">
          {resettableSections.map((section) => {
            const sectionIds = section.rows.map((row) => row.personId);
            return (
              <fieldset key={section.teamId ?? 'none'} className="space-y-1">
                <legend className="sr-only">{section.title}</legend>
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
              </fieldset>
            );
          })}
        </div>
        <Field label={copy.counters.resetDate} error={fieldError}>
          {(control) => (
            <input
              {...control}
              type="date"
              value={resetDate}
              max={teamMonth.today}
              onChange={(event) => setResetDate(event.target.value)}
              className="h-10 w-full rounded-control border border-line px-3"
            />
          )}
        </Field>
        <ErrorBanner message={bannerMessage} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {copy.counters.cancel}
          </Button>
          <Button type="submit" isPending={createResets.isPending} isDisabled={count === 0}>
            {`${copy.planning.resetSubmitPrefix} ${count} ${count === 1 ? copy.planning.counterSingular : copy.planning.counterPlural} ${copy.planning.resetSubmitSuffix}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
