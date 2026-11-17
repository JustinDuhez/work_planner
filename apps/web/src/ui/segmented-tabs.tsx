import { useRef, type KeyboardEvent } from 'react';

interface Tab {
  id: string;
  label: string;
  panelId: string;
}

const KEY_STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

export function SegmentedTabs({
  label,
  tabs,
  selectedId,
  onSelect,
}: {
  label: string;
  tabs: readonly Tab[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    onSelect(tab.id);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = KEY_STEP[event.key];
    if (step !== undefined) select((index + step + tabs.length) % tabs.length);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(tabs.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex gap-1 rounded-control bg-zinc-100 p-1"
    >
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selectedId;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isSelected}
            aria-controls={tab.panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`rounded-inner-md px-3 py-1.5 text-sm ${isSelected ? 'bg-white font-semibold text-zinc-900 shadow-card' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
