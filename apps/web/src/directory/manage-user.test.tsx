import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { directoryEntry } from '../test/directory-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const ADMIN_SESSION = {
  ...SIGNED_IN_SESSION,
  user: { ...SIGNED_IN_SESSION.user, roles: { isAdmin: true, isManager: false } },
};
const HUGO = directoryEntry({
  id: 9,
  firstName: 'Hugo',
  lastName: 'Laurent',
  email: 'hugo.laurent@example.com',
  canManage: true,
  canEditWorkingTime: true,
  workingTime: { dailyMinutes: 420, startDate: '2026-10-12', plannedChange: null },
});
const TEAMMATE = directoryEntry({
  id: 12,
  firstName: 'Camille',
  lastName: 'Simon',
  canManage: false,
  canEditWorkingTime: true,
  workingTime: { dailyMinutes: 420, startDate: '2026-10-12', plannedChange: null },
});

function renderAsViewer(entries: unknown[], extra: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/users': { status: 200, body: entries },
    ...extra,
  });
  renderApp('/annuaire');
  return { fetchMock, user: userEvent.setup() };
}

async function openManage(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const row = await screen.findByRole('row', { name });
  await user.click(within(row).getByRole('button', { name: copy.directory.manage }));
  return screen.getByRole('dialog', { name: copy.manageUser.title });
}

function findCall(
  fetchMock: jest.Mock,
  method: string,
  url: string,
): [string, RequestInit] | undefined {
  return fetchMock.mock.calls.find(
    ([callUrl, init]) => callUrl === url && (init as RequestInit | undefined)?.method === method,
  ) as [string, RequestInit] | undefined;
}

/** The JSON body of the request, once the mutation has sent it. */
async function sentBody(fetchMock: jest.Mock, method: string, url: string): Promise<unknown> {
  let body: unknown;
  await waitFor(() => {
    const call = findCall(fetchMock, method, url);
    expect(call).toBeDefined();
    body = JSON.parse(call?.[1].body as string);
  });
  return body;
}

describe('managing users', () => {
  it('shows every section to an admin and saves the identity', async () => {
    const { user, fetchMock } = renderAsViewer([HUGO], {
      'PATCH /api/v1/users/9': { status: 200, body: HUGO },
    });
    const dialog = await openManage(user, /Hugo Laurent/);

    const email = within(dialog).getByLabelText(copy.manageUser.email);
    await user.clear(email);
    await user.type(email, 'hugo.l@example.com');
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.saveIdentity }));

    expect(await sentBody(fetchMock, 'PATCH', '/api/v1/users/9')).toEqual({
      firstName: 'Hugo',
      lastName: 'Laurent',
      email: 'hugo.l@example.com',
    });
    expect(
      within(dialog).getByRole('heading', { name: copy.manageUser.accessTitle }),
    ).toBeInTheDocument();
  });

  it('asks before archiving, then archives', async () => {
    const { user, fetchMock } = renderAsViewer([HUGO], {
      'PATCH /api/v1/users/9': { status: 200, body: { ...HUGO, isArchived: true } },
    });
    const dialog = await openManage(user, /Hugo Laurent/);

    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.archive }));
    expect(
      within(dialog).getByText('Archiver Hugo Laurent ? Il ou elle ne pourra plus se connecter.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.confirm }));

    expect(await sentBody(fetchMock, 'PATCH', '/api/v1/users/9')).toEqual({ isArchived: true });
  });

  it('shows a refusal from the server in the dialog', async () => {
    const { user } = renderAsViewer([HUGO], {
      'PATCH /api/v1/users/9': {
        status: 409,
        body: {
          code: 'USER_MANAGES_TEAM',
          message: "Cette personne gère l'équipe « Back ». Désignez d'abord un autre responsable.",
        },
      },
    });
    const dialog = await openManage(user, /Hugo Laurent/);

    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.archive }));
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.confirm }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("gère l'équipe « Back »");
  });

  it('resets a password', async () => {
    const { user, fetchMock } = renderAsViewer([HUGO], {
      'PUT /api/v1/users/9/password': { status: 204 },
    });
    const dialog = await openManage(user, /Hugo Laurent/);

    await user.type(
      within(dialog).getByLabelText(copy.manageUser.newPassword),
      'a fresh temporary one',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.resetPassword }));
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.confirm }));

    expect(await sentBody(fetchMock, 'PUT', '/api/v1/users/9/password')).toEqual({
      newPassword: 'a fresh temporary one',
    });
  });

  it('plans a new daily time from a date', async () => {
    const { user, fetchMock } = renderAsViewer([HUGO], {
      'PATCH /api/v1/users/9/working-time': { status: 200, body: HUGO },
    });
    const dialog = await openManage(user, /Hugo Laurent/);

    const duration = within(dialog).getByLabelText(copy.manageUser.dailyTime);
    await user.clear(duration);
    await user.type(duration, '6:00');
    await user.type(within(dialog).getByLabelText(copy.manageUser.effectiveDate), '2026-11-16');
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.saveWorkingTime }));

    expect(await sentBody(fetchMock, 'PATCH', '/api/v1/users/9/working-time')).toEqual({
      dailyMinutes: 360,
      effectiveDate: '2026-11-16',
    });
  });

  it('refuses a daily time that is not H:MM before sending anything', async () => {
    const { user, fetchMock } = renderAsViewer([HUGO]);
    const dialog = await openManage(user, /Hugo Laurent/);

    const duration = within(dialog).getByLabelText(copy.manageUser.dailyTime);
    await user.clear(duration);
    await user.type(duration, 'abc');
    await user.click(within(dialog).getByRole('button', { name: copy.manageUser.saveWorkingTime }));

    expect(within(dialog).getByText(copy.manageUser.invalidDuration)).toBeInTheDocument();
    expect(findCall(fetchMock, 'PATCH', '/api/v1/users/9/working-time')).toBeUndefined();
  });

  it('shows a manager only the daily time of their team member', async () => {
    const { user } = renderAsViewer([TEAMMATE]);
    const dialog = await openManage(user, /Camille Simon/);

    expect(
      within(dialog).queryByRole('heading', { name: copy.manageUser.identityTitle }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(copy.manageUser.startDate)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(copy.manageUser.dailyTime)).toBeInTheDocument();
  });

  it('creates a user from the toolbar', async () => {
    const admin = directoryEntry({ id: 7, canManage: true });
    const { user, fetchMock } = renderAsViewer([admin], {
      'GET /api/v1/me': { status: 200, body: ADMIN_SESSION },
      'POST /api/v1/users': { status: 201, body: HUGO },
    });

    await user.click(await screen.findByRole('button', { name: copy.directory.newUser }));
    const dialog = screen.getByRole('dialog', { name: copy.newUser.title });
    await user.type(within(dialog).getByLabelText(copy.newUser.firstName), 'Zoé');
    await user.type(within(dialog).getByLabelText(copy.newUser.lastName), 'Adam');
    await user.type(within(dialog).getByLabelText(copy.newUser.email), 'zoe.adam@example.com');
    await user.type(
      within(dialog).getByLabelText(copy.newUser.initialPassword),
      'correct horse battery',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.newUser.create }));

    expect(await sentBody(fetchMock, 'POST', '/api/v1/users')).toEqual({
      firstName: 'Zoé',
      lastName: 'Adam',
      email: 'zoe.adam@example.com',
      isAdmin: false,
      dailyMinutes: 420,
      initialPassword: 'correct horse battery',
    });
  });

  it('hides the admin toolbar and the manage action from a colleague', async () => {
    renderAsViewer([directoryEntry({ id: 9, firstName: 'Hugo', lastName: 'Laurent' })]);

    expect(await screen.findByRole('row', { name: /Hugo Laurent/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.directory.newUser })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.directory.manage })).not.toBeInTheDocument();
  });
});
