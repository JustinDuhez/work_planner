import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { directoryEntry } from '../test/directory-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';
import { teamView } from '../test/team-fixtures';

const ADMIN_SESSION = {
  ...SIGNED_IN_SESSION,
  user: { ...SIGNED_IN_SESSION.user, roles: { isAdmin: true, isManager: false } },
};
const SOPHIE = { id: 2, firstName: 'Sophie', lastName: 'Dubois' };
const LEA = { id: 7, firstName: 'Léa', lastName: 'Moreau' };
const HUGO = { id: 9, firstName: 'Hugo', lastName: 'Laurent' };
const PEOPLE = [
  directoryEntry({ id: 2, firstName: 'Sophie', lastName: 'Dubois' }),
  directoryEntry({ id: 7, firstName: 'Léa', lastName: 'Moreau' }),
  directoryEntry({ id: 9, firstName: 'Hugo', lastName: 'Laurent' }),
];
const DIRECTION = teamView({ id: 1, name: 'Direction', canManage: true });
const FRONT = teamView({
  id: 3,
  name: 'Front',
  parentTeamId: 1,
  manager: SOPHIE,
  members: [LEA],
  canManage: true,
});
const MOBILE = teamView({ id: 4, name: 'Mobile', parentTeamId: 3, canManage: true });
const SALES = teamView({ id: 5, name: 'Commercial', canManage: true });
const TEAMS = [SALES, DIRECTION, FRONT, MOBILE];

function renderAsAdmin(extra: Record<string, MockResponse> = {}, teams = TEAMS) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/me': { status: 200, body: ADMIN_SESSION },
    'GET /api/v1/teams': { status: 200, body: teams },
    'GET /api/v1/users': { status: 200, body: PEOPLE },
    ...extra,
  });
  renderApp('/equipes');
  return { fetchMock, user: userEvent.setup() };
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

async function sentBody(fetchMock: jest.Mock, method: string, url: string): Promise<unknown> {
  let body: unknown;
  await waitFor(() => {
    const call = findCall(fetchMock, method, url);
    expect(call).toBeDefined();
    body = JSON.parse(call?.[1].body as string);
  });
  return body;
}

async function openEdit(user: ReturnType<typeof userEvent.setup>, teamName: string) {
  const item = await screen.findByRole('listitem', { name: teamName });
  await user.click(
    within(item).getAllByRole('button', { name: copy.teamDialog.edit })[0] as HTMLElement,
  );
  return screen.getByRole('dialog', { name: copy.teamDialog.editTitle });
}

describe('managing teams', () => {
  it('creates a team from the toolbar', async () => {
    const { user, fetchMock } = renderAsAdmin({
      'POST /api/v1/teams': { status: 201, body: SALES },
    });

    await user.click(await screen.findByRole('button', { name: copy.teamDialog.newTeam }));
    const dialog = screen.getByRole('dialog', { name: copy.teamDialog.createTitle });
    await user.type(within(dialog).getByLabelText(copy.teamDialog.name), 'Support');
    await user.selectOptions(within(dialog).getByLabelText(copy.teamDialog.parent), 'Direction');
    await user.selectOptions(
      within(dialog).getByLabelText(copy.teamDialog.manager),
      'Sophie Dubois',
    );
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' }));
    await user.click(within(dialog).getByRole('button', { name: copy.teamDialog.save }));

    expect(await sentBody(fetchMock, 'POST', '/api/v1/teams')).toEqual({
      name: 'Support',
      parentTeamId: 1,
      managerId: 2,
      memberIds: [9],
    });
  });

  it('never offers a team or its sub-teams as its own parent', async () => {
    const { user } = renderAsAdmin();
    const dialog = await openEdit(user, 'Front');

    const options = within(within(dialog).getByLabelText(copy.teamDialog.parent)).getAllByRole(
      'option',
    );

    expect(options.map((option) => option.textContent)).toEqual([
      copy.teamDialog.noParent,
      'Commercial',
      'Direction',
    ]);
  });

  it('saves the whole member set with the other fields', async () => {
    const { user, fetchMock } = renderAsAdmin({
      'PATCH /api/v1/teams/3': { status: 200, body: FRONT },
    });
    const dialog = await openEdit(user, 'Front');

    await user.click(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' }));
    await user.click(within(dialog).getByRole('button', { name: copy.teamDialog.save }));

    expect(await sentBody(fetchMock, 'PATCH', '/api/v1/teams/3')).toEqual({
      name: 'Front',
      parentTeamId: 1,
      managerId: 2,
      memberIds: [7, 9],
    });
  });

  it('filters the people list', async () => {
    const { user } = renderAsAdmin();
    const dialog = await openEdit(user, 'Front');

    await user.type(within(dialog).getByLabelText(copy.teamDialog.memberFilter), 'hug');

    expect(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('checkbox', { name: 'Sophie Dubois' }),
    ).not.toBeInTheDocument();
  });

  it('shows a cycle refusal from the server in the banner', async () => {
    const { user } = renderAsAdmin({
      'PATCH /api/v1/teams/3': {
        status: 409,
        body: {
          code: 'TEAM_CYCLE',
          message:
            'Une équipe ne peut pas être placée sous elle-même ou sous une de ses sous-équipes.',
        },
      },
    });
    const dialog = await openEdit(user, 'Front');

    await user.click(within(dialog).getByRole('button', { name: copy.teamDialog.save }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'sous une de ses sous-équipes',
    );
  });

  it('asks before deleting and says how many members leave', async () => {
    const { user, fetchMock } = renderAsAdmin({ 'DELETE /api/v1/teams/5': { status: 204 } }, [
      teamView({ ...SALES, members: [LEA, HUGO] }),
    ]);
    const item = await screen.findByRole('listitem', { name: 'Commercial' });

    await user.click(within(item).getByRole('button', { name: copy.teamDialog.delete }));
    const dialog = screen.getByRole('dialog', { name: copy.teamDialog.deleteTitle });
    expect(
      within(dialog).getByText(
        "Supprimer l'équipe « Commercial » ? Ses 2 membres en seront retirés (leurs comptes ne changent pas).",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.teamDialog.confirmDelete }));

    await waitFor(() => expect(findCall(fetchMock, 'DELETE', '/api/v1/teams/5')).toBeDefined());
  });

  it('disables deleting a team that has sub-teams, with the reason', async () => {
    renderAsAdmin();
    const item = await screen.findByRole('listitem', { name: 'Front' });

    const deleteButton = within(item).getAllByRole('button', {
      name: copy.teamDialog.delete,
    })[0] as HTMLElement;

    expect(deleteButton).toBeDisabled();
    expect(within(item).getAllByText(copy.teamDialog.hasSubteams)[0]).toBeInTheDocument();
  });

  it('shows no management controls to a collaborator', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/teams': { status: 200, body: [teamView({ name: 'Front' })] },
    });
    renderApp('/equipes');

    expect(await screen.findByRole('listitem', { name: 'Front' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.teamDialog.newTeam })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.teamDialog.edit })).not.toBeInTheDocument();
  });
});
