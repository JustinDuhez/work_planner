import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

describe('UserMenu', () => {
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
