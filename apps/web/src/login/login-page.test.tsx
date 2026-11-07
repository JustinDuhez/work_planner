import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const ANONYMOUS = { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Expirée' } };

async function fillAndSubmit(email: string, password: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(copy.login.email), email);
  await user.type(screen.getByLabelText(copy.login.password), password);
  await user.click(screen.getByRole('button', { name: copy.login.submit }));
}

describe('LoginPage', () => {
  it('shows the server message when the credentials are wrong', async () => {
    mockFetchRoutes({
      'GET /api/v1/me': ANONYMOUS,
      'POST /api/v1/sessions': {
        status: 401,
        body: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' },
      },
    });
    renderApp('/connexion');

    await fillAndSubmit('lea.moreau@example.com', 'wrong password!!');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');
  });

  it('shows field messages next to the fields', async () => {
    mockFetchRoutes({
      'GET /api/v1/me': ANONYMOUS,
      'POST /api/v1/sessions': {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Certains champs sont invalides.',
          fieldErrors: { email: 'Adresse email invalide.' },
        },
      },
    });
    renderApp('/connexion');

    await fillAndSubmit('pas-un-email', 'whatever');

    expect(await screen.findByText('Adresse email invalide.')).toBeInTheDocument();
  });

  it('returns to the page the user was going to after logging in', async () => {
    mockFetchRoutes({
      'GET /api/v1/me': ANONYMOUS,
      'POST /api/v1/sessions': { status: 201, body: SIGNED_IN_SESSION },
      'GET /api/v1/health': { status: 200, body: { status: 'ok', database: 'up' } },
    });
    const { router } = renderApp(`/connexion?retour=${encodeURIComponent('/profil')}`);

    await fillAndSubmit('lea.moreau@example.com', 'correct horse battery staple');

    await screen.findByRole('heading', { name: copy.profile.title });
    expect(router.state.location.pathname).toBe('/profil');
  });

  it('ignores a return address that leaves the app', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': ANONYMOUS,
      'POST /api/v1/sessions': { status: 201, body: SIGNED_IN_SESSION },
    });
    const { router } = renderApp(`/connexion?retour=${encodeURIComponent('//evil.com')}`);

    await fillAndSubmit('lea.moreau@example.com', 'correct horse battery staple');

    await screen.findByRole('heading', { name: copy.clock.title });
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows or hides the password on demand', async () => {
    mockFetchRoutes({ 'GET /api/v1/me': ANONYMOUS });
    renderApp('/connexion');
    const user = userEvent.setup();
    const passwordInput = await screen.findByLabelText(copy.login.password);

    await user.click(screen.getByRole('button', { name: copy.login.showPassword }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: copy.login.hidePassword }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
