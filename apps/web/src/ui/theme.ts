export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Storage can be blocked (private mode, site data off): fall back to the device setting.
function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Before the first render: the saved choice, else the device setting (followed live until a choice is saved). */
export function initTheme(): void {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  applyTheme(savedTheme() ?? (media?.matches ? 'dark' : 'light'));
  media?.addEventListener('change', (event) => {
    if (savedTheme() === null) applyTheme(event.matches ? 'dark' : 'light');
  });
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not saved: the choice lasts for this page only.
  }
}
