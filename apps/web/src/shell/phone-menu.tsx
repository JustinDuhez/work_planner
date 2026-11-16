import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { copy } from '../copy';
import { MAIN_ID, NAV_ITEMS } from './nav-items';

export function PhoneMenu() {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeAndRefocus() {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAndRefocus();
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeAndRefocus();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const Icon = isOpen ? X : Menu;
  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen((wasOpen) => !wasOpen);
        }}
        className="flex h-9 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        <Icon size={18} aria-hidden /> {copy.shell.menu}
      </button>
      {isOpen ? (
        <nav
          id={panelId}
          aria-label={copy.shell.menu}
          className="absolute right-0 top-full mt-2 flex w-56 flex-col rounded-card border border-line bg-white p-1 shadow-popover"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'isEnd' in item}
              onClick={() => {
                setIsOpen(false);
                // The clicked link leaves with the panel: start the new page at its main landmark.
                document.getElementById(MAIN_ID)?.focus();
              }}
              className={({ isActive }) =>
                `rounded-inner-sm px-3 py-2 text-sm hover:bg-zinc-100 ${isActive ? 'bg-primary-50 font-semibold text-primary-700' : 'text-zinc-700'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
