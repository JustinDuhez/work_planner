import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

describe('UserMenu', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('switches to dark mode and back, saving each choice', async () => {
    mockFetchRoutes({ ...signedInHomeRoutes() });
    renderApp('/');
    const user = userEvent.setup();

    const toggle = await screen.findByRole('switch', { name: copy.userMenu.darkMode });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it("shows the user's initials", async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
    });

    renderApp('/');

    expect(await screen.findByRole('button', { name: copy.userMenu.open })).toHaveTextContent('LM');
  });

  it('logs out and returns to the login page', async () => {
    const fetchMock = mockFetchRoutes({
      ...signedInHomeRoutes(),
      'DELETE /api/v1/sessions/current': { status: 204 },
    });
    const { router } = renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: copy.userMenu.logout }));

    await screen.findByRole('heading', { name: copy.login.title });
    expect(router.state.location.pathname).toBe('/connexion');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/sessions/current',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
