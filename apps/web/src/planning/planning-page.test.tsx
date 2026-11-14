import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatSignedMinutes } from '@work-planner/domain';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
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

describe('PlanningPage', () => {
  it("starts on the viewer's team, manager first, with week headers and today", async () => {
    renderPlanning('/planning?mois=2026-11');

    const grid = await table();

    expect(within(grid).getByRole('columnheader', { name: 'S46' })).toBeInTheDocument();
    expect(
      within(grid).getByRole('rowheader', { name: /Sophie Dubois.*Responsable/ }),
    ).toBeInTheDocument();
    expect(within(grid).queryByText('Claire Martin')).not.toBeInTheDocument();
    expect(
      within(grid)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      expect.stringContaining('Sophie Dubois'),
      expect.stringContaining('Hugo Laurent'),
      expect.stringContaining('Léa Moreau'),
    ]);
    expect(within(grid).getByRole('columnheader', { current: 'date' })).toHaveTextContent('13');
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
    expect(
      within(grid)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual([expect.stringContaining('Léa Moreau')]);
    expect(screen.getByText('1 personne')).toBeInTheDocument();
  });

  it('says when nobody is absent today', async () => {
    renderPlanning('/planning?mois=2026-11&equipe=toutes&absents=1', {
      'GET /api/v1/team-months/2026-11': {
        status: 200,
        body: teamMonth({
          people: teamMonth().people.map((person) => ({ ...person, halfDays: [] })),
        }),
      },
    });

    expect(await screen.findByText(copy.planning.nobodyAbsent)).toBeInTheDocument();
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

  it('disables the previous month at January 2000', async () => {
    renderPlanning('/planning?mois=2000-01', {
      'GET /api/v1/team-months/2000-01': {
        status: 200,
        body: teamMonth({ month: { startDate: '2000-01-01', endDate: '2000-01-31' } }),
      },
    });

    expect(await screen.findByRole('button', { name: copy.planning.previousMonth })).toBeDisabled();
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
});
