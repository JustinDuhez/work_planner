import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatSignedMinutes } from '@work-planner/domain';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { expectNoAxeViolations } from '../test/axe';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { teamMonth } from '../test/planning-fixtures';
import { renderApp } from '../test/render-app';

function renderPlanning(path: string, extra: Record<string, MockResponse> = {}) {
  mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/team-months/2026-11': { status: 200, body: teamMonth() },
    ...extra,
  });
  const rendered = renderApp(path);
  return { ...rendered, user: userEvent.setup() };
}

async function table() {
  return screen.findByRole('table', { name: /novembre 2026/ });
}

const realFetch = globalThis.fetch;
let releaseHeld: (() => void) | undefined;

// Holds the December answer on a promise the test (or afterEach) releases.
function holdDecember(): () => void {
  const answer = globalThis.fetch;
  const held = new Promise<void>((resolve) => (releaseHeld = resolve));
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.endsWith('/2026-12')) {
      await held;
      const month = { startDate: '2026-12-01', endDate: '2026-12-31' };
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(teamMonth({ month })),
      } as Response;
    }
    return answer(input, init);
  });
  return () => releaseHeld?.();
}

afterEach(() => {
  releaseHeld?.();
  releaseHeld = undefined;
  globalThis.fetch = realFetch;
});

// The team group headings are row headers too: only the person rows (scope="row") are names.
function personNames(grid: HTMLElement) {
  return within(grid)
    .getAllByRole('rowheader')
    .filter((cell) => cell.getAttribute('scope') === 'row')
    .map((cell) => cell.textContent);
}

describe('PlanningPage', () => {
  it("starts on the viewer's team, manager first, with week headers and today", async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    expect(within(grid).getByRole('columnheader', { name: 'S46' })).toBeInTheDocument();
    expect(
      within(grid).getByRole('rowheader', { name: /Sophie Dubois.*Responsable/ }),
    ).toBeInTheDocument();
    expect(within(grid).queryByText('Claire Martin')).not.toBeInTheDocument();
    expect(personNames(grid)).toEqual([
      expect.stringContaining('Sophie Dubois'),
      expect.stringContaining('Hugo Laurent'),
      expect.stringContaining('Léa Moreau'),
    ]);
    const todayHeader = within(grid).getByRole('columnheader', { current: 'date' });
    expect(todayHeader).toHaveTextContent('13');
    expect(todayHeader).toHaveTextContent(copy.calendar.today);
  });

  it('labels absences and holidays in text and shows balances', async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    expect(within(grid).getAllByText('13 nov. : Congé · matin')).toHaveLength(1);
    expect(
      within(grid).getByText('23 nov. : Télétravail · après-midi (en attente)'),
    ).toBeInTheDocument();
    expect(within(grid).getAllByText('11 nov. : Férié · Armistice').length).toBeGreaterThan(0);
    // formatSignedMinutes uses the typographic minus sign.
    expect(within(grid).getByText(formatSignedMinutes(-90))).toBeInTheDocument();
  });

  it('switches to every team through the URL, people without a team last', async () => {
    const { user, router } = renderPlanning('/planning?mois=2026-11');

    await user.selectOptions(
      await screen.findByLabelText(copy.planning.teamFilter),
      copy.planning.allTeams,
    );

    expect(router.state.location.search).toContain('equipe=toutes');
    const grid = await table();
    expect(within(grid).getByRole('rowheader', { name: /Claire Martin/ })).toBeInTheDocument();
    expect(within(grid).getAllByRole('row', { name: copy.planning.noTeam })).toHaveLength(1);
  });

  it('keeps only people absent today', async () => {
    const { user } = renderPlanning('/planning?mois=2026-11&equipe=toutes');

    await user.click(await screen.findByRole('checkbox', { name: copy.planning.absentToday }));

    const grid = await table();
    expect(personNames(grid)).toEqual([expect.stringContaining('Léa Moreau')]);
    expect(screen.getByText('1 personne')).toBeInTheDocument();
  });

  it('says when nobody is absent today', async () => {
    renderPlanning('/planning?mois=2026-11&equipe=toutes&absents=1', {
      'GET /api/v1/team-months/2026-11': {
        status: 200,
        body: teamMonth({ absentTodayUserIds: [] }),
      },
    });

    expect(await screen.findByText(copy.planning.nobodyAbsent)).toBeInTheDocument();
  });

  it("keeps today's absentees whatever month is shown", async () => {
    renderPlanning('/planning?mois=2026-12&equipe=toutes&absents=1', {
      'GET /api/v1/team-months/2026-12': {
        status: 200,
        body: teamMonth({
          month: { startDate: '2026-12-01', endDate: '2026-12-31' },
          // December holds no half-day of today: only the server's list can name Léa.
          people: teamMonth().people.map((person) => ({ ...person, halfDays: [] })),
          absentTodayUserIds: [7],
        }),
      },
    });

    const grid = await screen.findByRole('table', { name: /décembre 2026/ });
    expect(personNames(grid)).toEqual([expect.stringContaining('Léa Moreau')]);
  });

  it('shows a parent team together with its sub-teams, counting each person once', async () => {
    renderPlanning('/planning?mois=2026-11&equipe=1');

    const grid = await table();

    expect(within(grid).getByText('Tech')).toBeInTheDocument();
    expect(within(grid).getByText('Tech › Front')).toBeInTheDocument();
    expect(within(grid).getByRole('rowheader', { name: /Claire Martin/ })).toBeInTheDocument();
    expect(within(grid).getByRole('rowheader', { name: /Léa Moreau/ })).toBeInTheDocument();
    expect(screen.getByText('4 personnes')).toBeInTheDocument();
  });

  it('says in text that a balance has a refused correction to take up again', async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    expect(within(grid).getAllByText(copy.planning.openRefusal)).toHaveLength(1);
    expect(
      within(within(grid).getByRole('rowheader', { name: /Hugo Laurent/ })).getByText(
        copy.planning.openRefusal,
      ),
    ).toBeInTheDocument();
  });

  it('moves to the next month in the URL', async () => {
    const { user, router } = renderPlanning('/planning?mois=2026-11', {
      'GET /api/v1/team-months/2026-12': {
        status: 200,
        body: teamMonth({ month: { startDate: '2026-12-01', endDate: '2026-12-31' } }),
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.planning.nextMonth }));

    expect(router.state.location.search).toContain('mois=2026-12');
  });

  it('disables the next month at December 2100', async () => {
    renderPlanning('/planning?mois=2100-12', {
      'GET /api/v1/team-months/2100-12': {
        status: 200,
        body: teamMonth({ month: { startDate: '2100-12-01', endDate: '2100-12-31' } }),
      },
    });

    expect(await screen.findByRole('button', { name: copy.planning.nextMonth })).toBeDisabled();
  });

  it('lists absences as text on phone cards', async () => {
    renderPlanning('/planning?mois=2026-11');

    const cards = await screen.findByRole('list', { name: copy.planning.cardsLabel });
    const lea = within(cards).getByRole('listitem', { name: 'Léa Moreau' });

    expect(within(lea).getByText('Congé · 13 nov.')).toBeInTheDocument();
    expect(
      within(lea).getByText('Télétravail · 23 nov. après-midi (en attente)'),
    ).toBeInTheDocument();
    expect(
      within(within(cards).getByRole('listitem', { name: 'Sophie Dubois' })).getByText(
        copy.planning.noAbsence,
      ),
    ).toBeInTheDocument();
  });

  it('links a name to their calendar and has a Planning link in the header', async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    expect(within(grid).getByRole('link', { name: 'Léa Moreau' })).toHaveAttribute(
      'href',
      '/calendrier/7',
    );
    expect(screen.getByRole('link', { name: copy.nav.planning })).toHaveAttribute(
      'href',
      '/planning',
    );
  });

  it('falls back to the default team when the URL names an unknown one', async () => {
    renderPlanning('/planning?mois=2026-11&equipe=99');
    await table();

    expect(await screen.findByLabelText(copy.planning.teamFilter)).toHaveDisplayValue(
      'Tech › Front',
    );
  });

  it('shows an alert when the month cannot be loaded', async () => {
    renderPlanning('/planning?mois=2026-11', {
      'GET /api/v1/team-months/2026-11': { status: 500, body: {} },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.planning.loadError);
  });

  it('keeps the chosen team in the URL when moving to another month', async () => {
    const { user, router } = renderPlanning('/planning?mois=2026-11&equipe=3', {
      'GET /api/v1/team-months/2026-12': {
        status: 200,
        body: teamMonth({ month: { startDate: '2026-12-01', endDate: '2026-12-31' } }),
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.planning.nextMonth }));

    expect(router.state.location.search).toContain('equipe=3');
    const grid = await screen.findByRole('table', { name: /décembre 2026/ });
    expect(within(grid).getByRole('rowheader', { name: /Sophie Dubois/ })).toBeInTheDocument();
    expect(within(grid).queryByText('Claire Martin')).not.toBeInTheDocument();
  });

  it('keeps the chosen team when moving on again while a month is still loading', async () => {
    const { user, router } = renderPlanning('/planning?mois=2026-11&equipe=3', {
      'GET /api/v1/team-months/2027-01': {
        status: 200,
        body: teamMonth({ month: { startDate: '2027-01-01', endDate: '2027-01-31' } }),
      },
    });
    await table();
    holdDecember();

    await user.click(screen.getByRole('button', { name: copy.planning.nextMonth }));
    await user.click(screen.getByRole('button', { name: copy.planning.nextMonth }));

    expect(router.state.location.search).toContain('mois=2027-01');
    expect(router.state.location.search).toContain('equipe=3');
  });

  it('shows the loading text, not the previous month, while the next month loads', async () => {
    const { user } = renderPlanning('/planning?mois=2026-11&equipe=3');
    await table();
    const release = holdDecember();

    await user.click(screen.getByRole('button', { name: copy.planning.nextMonth }));

    expect(screen.getByText('décembre 2026')).toBeInTheDocument();
    expect(screen.getByText(copy.planning.loading)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /novembre 2026/ })).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('table', { name: /décembre 2026/ })).toBeInTheDocument();
  });

  it('names each team group by its path', async () => {
    renderPlanning('/planning?mois=2026-11&equipe=toutes');

    await table();

    expect(screen.getByRole('rowgroup', { name: 'Tech › Front' })).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', { name: 'Tech' })).toBeInTheDocument();
  });

  it('loads the month again on demand after a failure', async () => {
    const url = '/api/v1/team-months/2026-11';
    const { queryClient, container } = renderPlanning('/planning?mois=2026-11', {
      [`GET ${url}`]: { status: 500, body: {} },
    });
    const fetchMock = globalThis.fetch as jest.Mock;

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.planning.loadError);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: copy.states.retry }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === url)).toHaveLength(2));
  });

  it('announces the loading as one busy region', async () => {
    renderPlanning('/planning?mois=2026-11');
    const answer = globalThis.fetch;
    globalThis.fetch = (input, init) =>
      typeof input === 'string' && input.includes('/team-months/')
        ? new Promise<Response>(() => undefined)
        : answer(input, init);

    renderApp('/planning?mois=2026-11');

    const label = await screen.findByText(copy.planning.loading);
    expect(label.closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows an empty state when nobody is absent, and has no accessibility violation', async () => {
    const { queryClient, container } = renderPlanning('/planning?mois=2026-11&absents=1', {
      'GET /api/v1/team-months/2026-11': {
        status: 200,
        body: teamMonth({ absentTodayUserIds: [] }),
      },
    });

    const message = await screen.findByText(copy.planning.nobodyAbsent);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(message).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('has no accessibility violation once loaded', async () => {
    const { queryClient, container } = renderPlanning('/planning?mois=2026-11');

    await table();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('keeps the month on screen when a background refresh fails', async () => {
    const { queryClient } = renderPlanning('/planning?mois=2026-11');
    await table();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/team-months/2026-11': { status: 500, body: {} },
    });

    await act(() => queryClient.refetchQueries({ queryKey: ['team-month'] }));
    // TanStack Query tells its observers on the next macrotask: let the page render the failure.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(queryClient.getQueryState(['team-month', '2026-11'])?.status).toBe('error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: /novembre 2026/ })).toBeInTheDocument();
  });

  it('shows today’s absentees in a side card with their count and initials', async () => {
    renderPlanning('/planning?mois=2026-11');

    const card = await screen.findByRole('region', { name: copy.planning.absentToday });

    expect(within(card).getByText('1')).toBeInTheDocument();
    expect(within(card).getByText('Léa Moreau')).toBeInTheDocument();
    expect(within(card).getByText('LM')).toHaveAttribute('aria-hidden', 'true');
  });

  it('only counts absentees among the people shown', async () => {
    renderPlanning('/planning?mois=2026-11', {
      'GET /api/v1/team-months/2026-11': {
        status: 200,
        body: teamMonth({ absentTodayUserIds: [7, 12] }),
      },
    });

    const card = await screen.findByRole('region', { name: copy.planning.absentToday });

    expect(within(card).getByText('1')).toBeInTheDocument();
    expect(within(card).queryByText('Inès Bernard')).not.toBeInTheDocument();
  });

  it('shows 0 and no sentence in the card when nobody is absent', async () => {
    renderPlanning('/planning?mois=2026-11', {
      'GET /api/v1/team-months/2026-11': {
        status: 200,
        body: teamMonth({ absentTodayUserIds: [] }),
      },
    });

    const card = await screen.findByRole('region', { name: copy.planning.absentToday });

    expect(within(card).getByText('0')).toBeInTheDocument();
    expect(within(card).queryByText(copy.planning.nobodyAbsent)).not.toBeInTheDocument();
  });

  it('puts an initials avatar next to each name without changing the name', async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    const header = within(grid).getByRole('rowheader', { name: /Sophie Dubois.*Responsable/ });
    expect(within(header).getByText('SD')).toHaveAttribute('aria-hidden', 'true');
    const cards = screen.getByRole('list', { name: copy.planning.cardsLabel });
    const card = within(cards).getByRole('listitem', { name: 'Sophie Dubois' });
    expect(within(card).getByText('SD')).toHaveAttribute('aria-hidden', 'true');
    expect(within(card).getByRole('link', { name: 'Sophie Dubois' })).toBeInTheDocument();
  });

  it('announces the loading and shows no absentee card yet', async () => {
    mockFetchRoutes({ ...signedInHomeRoutes() });
    const initialFetch = globalThis.fetch;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
      typeof input === 'string' && input.includes('/team-months/')
        ? new Promise<Response>(() => undefined)
        : initialFetch(input, init),
    ) as typeof fetch;
    renderApp('/planning?mois=2026-11');

    expect(await screen.findByText(copy.planning.loading)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: copy.planning.absentToday })).toBeNull();
  });
});
