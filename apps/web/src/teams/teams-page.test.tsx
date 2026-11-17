import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { expectNoAxeViolations } from '../test/axe';
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

    expect(within(direction).getByText('Claire Martin')).toBeInTheDocument();
    expect(within(front).getByText('Sophie Dubois')).toBeInTheDocument();
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
    expect(screen.getByText('0 membre')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: copy.states.retry })).toBeInTheDocument();
  });

  it('has no detectable accessibility problems', async () => {
    const { container, queryClient } = renderTeams();
    await screen.findByRole('listitem', { name: 'Direction' });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('has an Équipes link in the header', async () => {
    renderTeams();

    expect(await screen.findByRole('link', { name: copy.nav.teams })).toHaveAttribute(
      'href',
      '/equipes',
    );
  });
});

describe('TeamsPage selection and side card', () => {
  it('shows each team with its manager and member count on one line', async () => {
    renderTeams();

    const front = await screen.findByRole('listitem', { name: 'Front' });

    expect(within(front).getByText('Sophie Dubois')).toBeInTheDocument();
    expect(within(front).getByText('2 membres')).toBeInTheDocument();
  });

  it('selects the team you belong to first and lists its manager and members', async () => {
    renderTeams();

    const front = await screen.findByRole('button', { name: 'Front' });

    expect(front).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Direction' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const card = screen.getByRole('region', { name: 'Front' });
    expect(within(card).getByText('Sophie Dubois')).toBeInTheDocument();
    expect(within(card).getByText(copy.teams.managerTag)).toBeInTheDocument();
    expect(within(card).getByText('HL')).toBeInTheDocument();
  });

  it('selects the team you manage before the ones you belong to', async () => {
    renderTeams([
      teamView({
        id: 1,
        name: 'Alpha',
        members: [{ id: 7, firstName: 'Léa', lastName: 'Moreau' }],
      }),
      teamView({ id: 2, name: 'Beta', manager: { id: 7, firstName: 'Léa', lastName: 'Moreau' } }),
    ]);

    expect(await screen.findByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('falls back to the first team of the tree', async () => {
    renderTeams([teamView({ id: 1, name: 'Alpha' }), teamView({ id: 2, name: 'Beta' })]);

    expect(await screen.findByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('selects another team when its name is clicked', async () => {
    const { user } = renderTeams();

    await user.click(await screen.findByRole('button', { name: 'Direction' }));

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Direction' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Direction' }).closest('[data-selected]'),
    ).toHaveAttribute('data-selected', 'true');
    expect(
      screen.getByRole('button', { name: 'Front' }).closest('[data-selected]'),
    ).toHaveAttribute('data-selected', 'false');
  });

  it('says when the selected team has no member', async () => {
    renderTeams([teamView({ id: 2, name: 'Vide' })]);

    expect(await screen.findByText(copy.teams.noMembers)).toBeInTheDocument();
  });

  it('keeps the side card placeholder while the teams load', async () => {
    mockFetchRoutes({ ...signedInHomeRoutes() });
    const initialFetch = globalThis.fetch;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
      input === '/api/v1/teams'
        ? new Promise<Response>(() => undefined)
        : initialFetch(input, init),
    ) as typeof fetch;
    const { container } = renderApp('/equipes');

    await waitFor(() =>
      expect(
        container.querySelectorAll('[data-slot="aside"] [aria-hidden]').length,
      ).toBeGreaterThan(0),
    );
    expect(container.querySelector('[data-slot="aside"] section')).toBeNull();
  });
});

describe('TeamsPage accessibility and card', () => {
  it('has no accessibility problems with a team selected', async () => {
    const { container, queryClient, user } = renderTeams();
    await user.click(await screen.findByRole('button', { name: 'Direction' }));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('has no accessibility problems when the teams fail to load', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/teams': { status: 500, body: { code: 'INTERNAL', message: 'x' } },
    });
    const { container, queryClient } = renderApp('/equipes');
    await screen.findByRole('alert');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('lists a manager who is also a member once', async () => {
    const sophie = { id: 2, firstName: 'Sophie', lastName: 'Dubois' };
    renderTeams([teamView({ id: 1, name: 'Front', manager: sophie, members: [sophie] })]);

    const card = await screen.findByRole('region', { name: 'Front' });

    expect(within(card).getAllByText('Sophie Dubois')).toHaveLength(1);
    expect(within(card).getByText(copy.teams.managerTag)).toBeInTheDocument();
  });
});
