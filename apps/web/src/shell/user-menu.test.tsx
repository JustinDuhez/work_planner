import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

describe('UserMenu', () => {
  it("shows the user's initials", async () => {
    mockFetchRoutes({
      'GET /api/v1/me': { status: 200, body: SIGNED_IN_SESSION },
      'GET /api/v1/health': { status: 200, body: { status: 'ok', database: 'up' } },
    });

    renderApp('/');

    expect(await screen.findByRole('button', { name: copy.userMenu.open })).toHaveTextContent('LM');
  });

  it('logs out and returns to the login page', async () => {
    const fetchMock = mockFetchRoutes({
      'GET /api/v1/me': { status: 200, body: SIGNED_IN_SESSION },
      'GET /api/v1/health': { status: 200, body: { status: 'ok', database: 'up' } },
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
