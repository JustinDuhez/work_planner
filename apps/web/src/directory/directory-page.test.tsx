import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { directoryEntry } from '../test/directory-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

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

  it('searches by name or email', async () => {
    const { user } = renderDirectory();

    await user.type(await screen.findByLabelText(copy.directory.search), 'fournier');

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + Lucas
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
  });

  it('says when nobody matches', async () => {
    const { user } = renderDirectory();

    await user.type(await screen.findByLabelText(copy.directory.search), 'zzz');

    expect(screen.getByText(copy.directory.empty)).toBeInTheDocument();
  });
});
