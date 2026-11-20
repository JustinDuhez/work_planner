import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { expectNoAxeViolations } from '../test/axe';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { directoryEntry } from '../test/directory-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { stat } from '../test/stat';
import { summaryPlaceholder } from '../test/summary-placeholder';
import { SIGNED_IN_SESSION } from '../test/sessions';

const LEA = directoryEntry();
const HUGO = directoryEntry({
  id: 9,
  firstName: 'Hugo',
  lastName: 'Laurent',
  email: 'hugo.laurent@example.com',
  teams: [
    { id: 3, name: 'Front' },
    { id: 4, name: 'Back' },
  ],
  managers: [],
});
const SOPHIE = directoryEntry({
  id: 2,
  firstName: 'Sophie',
  lastName: 'Dubois',
  email: 'sophie.dubois@example.com',
  isManager: true,
  teams: [{ id: 3, name: 'Front' }],
});
const LUCAS = directoryEntry({
  id: 11,
  firstName: 'Lucas',
  lastName: 'Fournier',
  email: 'lucas.fournier@example.com',
  isBlocked: true,
  teams: [{ id: 5, name: 'Commercial' }],
});

function renderDirectory(entries = [SOPHIE, LUCAS, HUGO, LEA]) {
  mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/users': { status: 200, body: entries },
  });
  const rendered = renderApp('/annuaire');
  return { ...rendered, user: userEvent.setup() };
}

describe('DirectoryPage', () => {
  it('labels every line of a person card', async () => {
    renderDirectory();

    const row = await screen.findByRole('row', { name: /Hugo Laurent/ });

    for (const label of [
      copy.directory.columnEmail,
      copy.directory.columnTeams,
      copy.directory.columnManagers,
      copy.directory.columnRole,
      copy.directory.columnWorkingTime,
    ]) {
      expect(within(row).getByText(label)).toBeInTheDocument();
    }
  });

  it('offers a retry when the directory cannot be loaded', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/users': { status: 500, body: { code: 'INTERNAL', message: 'x' } },
    });
    renderApp('/annuaire');

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.directory.loadError);
    expect(screen.getByRole('button', { name: copy.states.retry })).toBeInTheDocument();
  });

  it('has no detectable accessibility problems', async () => {
    const { container, queryClient } = renderDirectory();
    await screen.findByRole('row', { name: /Hugo Laurent/ });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('lists everyone with email, teams, managers and role', async () => {
    renderDirectory();

    const row = await screen.findByRole('row', { name: /Hugo Laurent/ });

    expect(within(row).getByText('hugo.laurent@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Front, Back')).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Sophie Dubois/ })).getByText(copy.roles.manager),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Lucas Fournier/ })).getByText(copy.directory.blocked),
    ).toBeInTheDocument();
  });

  it('searches by name', async () => {
    const { user } = renderDirectory();

    await user.type(await screen.findByLabelText(copy.directory.search), 'fournier');

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + Lucas
    expect(screen.getByRole('row', { name: /Lucas Fournier/ })).toBeInTheDocument();
  });

  it('searches by an email fragment that is not in the name', async () => {
    const { user } = renderDirectory();

    // "hugo.laurent" (with a dot) only occurs in the e-mail, the name is "Hugo Laurent".
    await user.type(await screen.findByLabelText(copy.directory.search), 'hugo.laurent');

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + Hugo
    expect(screen.getByRole('row', { name: /Hugo Laurent/ })).toBeInTheDocument();
  });

  it('filters by team', async () => {
    const { user } = renderDirectory();

    await screen.findByRole('row', { name: /Hugo Laurent/ }); // wait for the team options
    await user.selectOptions(screen.getByLabelText(copy.directory.teamFilter), 'Back');

    expect(screen.getByRole('row', { name: /Hugo Laurent/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Léa Moreau/ })).not.toBeInTheDocument();
  });

  it("opens a person's week from their name", async () => {
    const { user, router } = renderDirectory();

    await user.click(await screen.findByRole('link', { name: 'Hugo Laurent' }));

    expect(router.state.location.pathname).toBe('/pointage/9');
  });

  it('opens your own week from your own name', async () => {
    const { user, router } = renderDirectory();

    await user.click(await screen.findByRole('link', { name: 'Léa Moreau' }));

    expect(router.state.location.pathname).toBe('/');
  });

  it('shows working time only when it is visible, with a planned change', async () => {
    renderDirectory([
      directoryEntry({
        canEditWorkingTime: true,
        workingTime: {
          dailyMinutes: 420,
          startDate: '2026-10-12',
          plannedChange: { effectiveDate: '2026-11-16', dailyMinutes: 360 },
        },
      }),
    ]);

    expect(await screen.findByText('7:00 · 6:00 à partir du 16 nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('Arrivée le 12 oct. 2026')).toBeInTheDocument();
  });

  it('says when nobody matches', async () => {
    const { user } = renderDirectory();

    await user.type(await screen.findByLabelText(copy.directory.search), 'zzz');

    expect(screen.getByText(copy.directory.empty)).toBeInTheDocument();
  });

  it('shows an archived person as plain text, without a link to their week', async () => {
    renderDirectory([{ ...HUGO, isArchived: true }]);

    const row = await screen.findByRole('row', { name: /Hugo Laurent/ });
    expect(within(row).getByText('Hugo Laurent')).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: 'Hugo Laurent' })).not.toBeInTheDocument();
  });
});

const ADMIN_SESSION = {
  ...SIGNED_IN_SESSION,
  user: { ...SIGNED_IN_SESSION.user, roles: { isAdmin: true, isManager: false } },
};

function summaryCard() {
  return screen.getByRole('region', { name: copy.directory.summaryTitle });
}

describe('DirectoryPage summary and layout', () => {
  it('shows an avatar with the initials on every person', async () => {
    renderDirectory();

    const row = await screen.findByRole('row', { name: /Hugo Laurent/ });

    expect(within(row).getByText('HL')).toBeInTheDocument();
  });

  it('counts the people and the teams in the side card, without an archived count', async () => {
    renderDirectory();

    await screen.findByRole('row', { name: /Hugo Laurent/ });

    expect(summaryCard()).toHaveTextContent(stat(copy.directory.peopleCount, '4'));
    expect(summaryCard()).toHaveTextContent(stat(copy.directory.teamCount, '3'));
    expect(summaryCard()).not.toHaveTextContent(copy.directory.archivedCount);
  });

  it('keeps the counts when a search narrows the list', async () => {
    const { user } = renderDirectory();

    await user.type(await screen.findByLabelText(copy.directory.search), 'fournier');

    expect(summaryCard()).toHaveTextContent(stat(copy.directory.peopleCount, '4'));
  });

  it('hides the new person button from people who are not admins', async () => {
    renderDirectory();
    await screen.findByRole('row', { name: /Hugo Laurent/ });

    expect(screen.queryByRole('button', { name: copy.directory.newUser })).not.toBeInTheDocument();
  });

  it('counts archived people for an admin who shows them', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: ADMIN_SESSION },
      'GET /api/v1/users': { status: 200, body: [LEA, HUGO] },
      'GET /api/v1/users?archived=true': {
        status: 200,
        body: [LEA, { ...HUGO, isArchived: true }],
      },
    });
    renderApp('/annuaire');
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: copy.directory.newUser })).toBeInTheDocument();

    await user.click(screen.getByLabelText(copy.directory.archived));

    await waitFor(() =>
      expect(summaryCard()).toHaveTextContent(stat(copy.directory.archivedCount, '1')),
    );
    expect(summaryCard()).toHaveTextContent(stat(copy.directory.peopleCount, '1'));
  });

  it('announces the loading and shows no summary card yet', async () => {
    mockFetchRoutes({ ...signedInHomeRoutes() });
    const initialFetch = globalThis.fetch;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
      input === '/api/v1/users'
        ? new Promise<Response>(() => undefined)
        : initialFetch(input, init),
    ) as typeof fetch;
    renderApp('/annuaire');

    expect(await screen.findByText(copy.directory.loading)).toBeInTheDocument();
    expect(summaryPlaceholder()).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: copy.directory.summaryTitle })).toBeNull();
  });

  it('has no accessibility problems when empty', async () => {
    const { container, queryClient } = renderDirectory([]);
    await screen.findByText(copy.directory.empty);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('has no accessibility problems when the directory fails to load', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/users': { status: 500, body: { code: 'INTERNAL', message: 'x' } },
    });
    const { container, queryClient } = renderApp('/annuaire');
    await screen.findByRole('alert');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });
});
