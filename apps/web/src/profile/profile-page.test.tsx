import { screen, within } from '@testing-library/react';
import { PASSWORD_POLICY_MESSAGES } from '@work-planner/domain';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { NO_NOTIFICATIONS } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

function renderProfile(extraRoutes: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    'GET /api/v1/me': { status: 200, body: SIGNED_IN_SESSION },
    'GET /api/v1/notifications': { status: 200, body: NO_NOTIFICATIONS },
    ...extraRoutes,
  });
  renderApp('/profil');
  return { fetchMock, user: userEvent.setup() };
}

describe('ProfilePage', () => {
  it('shows the read-only account details', async () => {
    renderProfile();

    const details = await screen.findByRole('region', { name: copy.profile.infoTitle });
    expect(within(details).getByLabelText(copy.profile.email)).toHaveValue(
      'lea.moreau@example.com',
    );
    expect(within(details).getByText('Collaborateur')).toBeInTheDocument();
    expect(within(details).getByText('Front')).toBeInTheDocument();
    expect(within(details).getByText('Sophie Dubois')).toBeInTheDocument();
  });

  it('saves new names with the CSRF token and confirms it', async () => {
    const { fetchMock, user } = renderProfile({
      'PATCH /api/v1/me': { status: 200, body: { ...SIGNED_IN_SESSION.user, firstName: 'Lea' } },
    });
    const firstName = await screen.findByLabelText(copy.profile.firstName);

    await user.clear(firstName);
    await user.type(firstName, 'Lea');
    await user.click(screen.getByRole('button', { name: copy.profile.saveInfo }));

    expect(await screen.findByText(copy.profile.infoSaved)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Lea', lastName: 'Moreau' }),
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-test-token' }) as unknown,
      }),
    );
  });

  it('does not send a password change when the confirmation differs', async () => {
    const { fetchMock, user } = renderProfile();

    await user.type(
      await screen.findByLabelText(copy.password.current),
      'correct horse battery staple',
    );
    await user.type(screen.getByLabelText(copy.password.new), 'a brand new passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'a different passphrase');
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByText(copy.password.mismatch)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/me/password', expect.anything());
  });

  it.each([
    ['too short', 'a'.repeat(11), PASSWORD_POLICY_MESSAGES.TOO_SHORT],
    [
      'the same as the current one',
      'correct horse battery staple',
      PASSWORD_POLICY_MESSAGES.SAME_AS_CURRENT,
    ],
  ])('does not send a new password that is %s', async (_name, newPassword, message) => {
    const { fetchMock, user } = renderProfile();

    await user.type(
      await screen.findByLabelText(copy.password.current),
      'correct horse battery staple',
    );
    await user.type(screen.getByLabelText(copy.password.new), newPassword);
    await user.type(screen.getByLabelText(copy.password.confirm), newPassword);
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/me/password', expect.anything());
  });

  it('shows the strength of the new password while typing', async () => {
    const { user } = renderProfile();

    await user.type(await screen.findByLabelText(copy.password.new), 'abcdefgh12!X');

    expect(
      screen.getByText(`${copy.password.strengthLabel} ${copy.password.strength.strong}`),
    ).toBeInTheDocument();
  });

  it('shows the server message when the current password is wrong', async () => {
    const { user } = renderProfile({
      'PUT /api/v1/me/password': {
        status: 400,
        body: {
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'Le mot de passe actuel est incorrect.',
          fieldErrors: { currentPassword: 'Le mot de passe actuel est incorrect.' },
        },
      },
    });

    await user.type(await screen.findByLabelText(copy.password.current), 'not my password');
    await user.type(screen.getByLabelText(copy.password.new), 'a brand new passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByText('Le mot de passe actuel est incorrect.')).toBeInTheDocument();
  });

  it('confirms the change and empties the password fields', async () => {
    const { user } = renderProfile({ 'PUT /api/v1/me/password': { status: 204 } });

    await user.type(
      await screen.findByLabelText(copy.password.current),
      'correct horse battery staple',
    );
    await user.type(screen.getByLabelText(copy.password.new), 'a brand new passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByText(copy.password.changed)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.password.current)).toHaveValue('');
  });

  it('shows the server message when the password change fails without a field error', async () => {
    const { user } = renderProfile({
      'PUT /api/v1/me/password': {
        status: 429,
        body: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Trop de tentatives. Réessayez dans quelques minutes.',
        },
      },
    });

    await user.type(
      await screen.findByLabelText(copy.password.current),
      'correct horse battery staple',
    );
    await user.type(screen.getByLabelText(copy.password.new), 'a brand new passphrase');
    await user.type(screen.getByLabelText(copy.password.confirm), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans quelques minutes.',
    );
  });

  it('updates the header initials after the names are saved', async () => {
    const { user } = renderProfile({
      'PATCH /api/v1/me': { status: 200, body: { ...SIGNED_IN_SESSION.user, firstName: 'Zoé' } },
    });
    const firstName = await screen.findByLabelText(copy.profile.firstName);

    await user.clear(firstName);
    await user.type(firstName, 'Zoé');
    await user.click(screen.getByRole('button', { name: copy.profile.saveInfo }));

    await screen.findByText(copy.profile.infoSaved);
    expect(screen.getByRole('button', { name: copy.userMenu.open })).toHaveTextContent('ZM');
  });
});
