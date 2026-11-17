import { currentTheme, initTheme, setTheme } from './theme';

function mockSystemDark(isDark: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  window.matchMedia = jest.fn().mockReturnValue({
    matches: isDark,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
      listeners.push(listener),
  });
  return (matches: boolean) => listeners.forEach((listener) => listener({ matches }));
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('theme', () => {
  it('follows the device setting when nothing is saved', () => {
    mockSystemDark(true);
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses the saved choice over the device setting', () => {
    mockSystemDark(true);
    localStorage.setItem('theme', 'light');
    initTheme();
    expect(currentTheme()).toBe('light');
  });

  it('follows device changes only while nothing is saved', () => {
    const changeSystem = mockSystemDark(false);
    initTheme();
    changeSystem(true);
    expect(currentTheme()).toBe('dark');

    setTheme('light');
    changeSystem(true);
    expect(currentTheme()).toBe('light');
  });

  it('saves the choice and applies it', () => {
    setTheme('dark');
    expect(currentTheme()).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('still works when storage is blocked', () => {
    mockSystemDark(false);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    initTheme();
    expect(currentTheme()).toBe('light');
    setTheme('dark');
    expect(currentTheme()).toBe('dark');
  });
});
