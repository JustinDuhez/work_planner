import { screen } from '@testing-library/react';
import { copy } from '../copy';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const ANONYMOUS = { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Expirée' } };

describe('RequireAuth', () => {
  it('sends an anonymous visitor to the login page and remembers where they were going', async () => {
    mockFetchRoutes({ 'GET /api/v1/me': ANONYMOUS });

    const { router } = renderApp('/profil?onglet=mot-de-passe');

    expect(await screen.findByRole('heading', { name: copy.login.title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
    expect(router.state.location.search).toBe(
      `?retour=${encodeURIComponent('/profil?onglet=mot-de-passe')}`,
    );
  });

  it('lets a signed-in user through', async () => {
    mockFetchRoutes({
      'GET /api/v1/me': { status: 200, body: SIGNED_IN_SESSION },
      'GET /api/v1/health': { status: 200, body: { status: 'ok', database: 'up' } },
    });

    renderApp('/');

    expect(await screen.findByRole('heading', { name: copy.home.title })).toBeInTheDocument();
  });

  it('shows an error instead of the login page when the session cannot be checked', async () => {
    mockFetchRoutes({
      'GET /api/v1/me': { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Oups' } },
    });

    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.session.loadError);
  });
});
