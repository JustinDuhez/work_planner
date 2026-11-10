import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const MUST_CHANGE = {
  ...SIGNED_IN_SESSION,
  user: { ...SIGNED_IN_SESSION.user, mustChangePassword: true },
};

describe('forced password change', () => {
  it('sends the person to the password screen before anything else', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: MUST_CHANGE },
    });

    const { router } = renderApp('/annuaire');

    expect(
      await screen.findByRole('heading', { name: copy.forcedPassword.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/mot-de-passe');
    expect(router.state.location.search).toBe('?retour=%2Fannuaire');
  });

  it('goes back to the intended page once the password is chosen', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: MUST_CHANGE },
    });
    const { router } = renderApp('/mot-de-passe?retour=%2Fprofil');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(copy.password.current), 'the admin one is here');
    await user.type(screen.getByLabelText(copy.password.new), 'my very own passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'my very own passphrase');
    // From now on the server no longer requires a change (mockFetchRoutes replaces the table).
    mockFetchRoutes({ ...signedInHomeRoutes(), 'PUT /api/v1/me/password': { status: 204 } });
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByRole('heading', { name: copy.profile.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profil');
  });

  it('falls back to home when the return path is not a safe one', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: MUST_CHANGE },
    });
    const { router } = renderApp('/mot-de-passe?retour=https%3A%2F%2Fevil.example');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(copy.password.current), 'the admin one is here');
    await user.type(screen.getByLabelText(copy.password.new), 'my very own passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'my very own passphrase');
    mockFetchRoutes({ ...signedInHomeRoutes(), 'PUT /api/v1/me/password': { status: 204 } });
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByRole('link', { name: copy.nav.clock })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('never redirects someone who has nothing to change', async () => {
    mockFetchRoutes(signedInHomeRoutes());

    const { router } = renderApp('/');

    // The shell's nav only renders when RequireAuth let the page through.
    expect(await screen.findByRole('link', { name: copy.nav.clock })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('lets the person log out instead of choosing a password', async () => {
    const fetchMock = mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: MUST_CHANGE },
      'DELETE /api/v1/sessions/current': { status: 204 },
    });
    const { router } = renderApp('/mot-de-passe');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: copy.userMenu.logout }));

    expect(await screen.findByRole('heading', { name: copy.login.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/sessions/current',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
