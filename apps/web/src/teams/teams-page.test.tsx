import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { teamView } from '../test/team-fixtures';

const TEAMS = [
  teamView({
    id: 1,
    name: 'Direction',
    manager: { id: 4, firstName: 'Claire', lastName: 'Martin' },
  }),
  teamView({
    id: 3,
    name: 'Front',
    parentTeamId: 1,
    manager: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
    members: [
      { id: 9, firstName: 'Hugo', lastName: 'Laurent' },
      { id: 7, firstName: 'Léa', lastName: 'Moreau' },
    ],
  }),
];

function renderTeams(teams = TEAMS) {
  mockFetchRoutes({ ...signedInHomeRoutes(), 'GET /api/v1/teams': { status: 200, body: teams } });
  const rendered = renderApp('/equipes');
  return { ...rendered, user: userEvent.setup() };
}

describe('TeamsPage', () => {
  it('shows the tree with managers and member counts', async () => {
    renderTeams();

    const direction = await screen.findByRole('listitem', { name: 'Direction' });
    const front = within(direction).getByRole('listitem', { name: 'Front' });

    expect(within(direction).getByText('Responsable : Claire Martin')).toBeInTheDocument();
    expect(within(front).getByText('Responsable : Sophie Dubois')).toBeInTheDocument();
    expect(within(front).getByText('2 membres')).toBeInTheDocument();
  });

  it('says when a team has no manager', async () => {
    renderTeams([teamView({ name: 'Commercial' })]);

    expect(await screen.findByText(copy.teams.noManager)).toBeInTheDocument();
  });

  it("opens a member's week from their name", async () => {
    const { user, router } = renderTeams();

    await user.click(await screen.findByRole('link', { name: 'Hugo Laurent' }));

    expect(router.state.location.pathname).toBe('/pointage/9');
  });

  it('says when a team has one member or none', async () => {
    renderTeams([
      teamView({
        id: 1,
        name: 'Solo',
        members: [{ id: 9, firstName: 'Hugo', lastName: 'Laurent' }],
      }),
      teamView({ id: 2, name: 'Vide' }),
    ]);

    expect(await screen.findByText('1 membre')).toBeInTheDocument();
    expect(screen.getByText(copy.teams.noMembers)).toBeInTheDocument();
  });

  it('opens your own week from your own name', async () => {
    const { user, router } = renderTeams();

    await user.click(await screen.findByRole('link', { name: 'Léa Moreau' }));

    expect(router.state.location.pathname).toBe('/');
  });

  it('says when there are no teams yet', async () => {
    renderTeams([]);

    expect(await screen.findByText(copy.teams.empty)).toBeInTheDocument();
  });

  it('reports a loading failure', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/teams': { status: 500, body: { code: 'INTERNAL', message: 'x' } },
    });
    renderApp('/equipes');

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.teams.loadError);
  });

  it('has an Équipes link in the header', async () => {
    renderTeams();

    expect(await screen.findByRole('link', { name: copy.nav.teams })).toHaveAttribute(
      'href',
      '/equipes',
    );
  });
});
