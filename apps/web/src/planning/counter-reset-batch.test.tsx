import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { teamMonth } from '../test/planning-fixtures';
import { renderApp } from '../test/render-app';

const MANAGER_MONTH = teamMonth({ canResetUserIds: [2, 7, 9] });

function renderAsManager(extra: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/team-months/2026-11': { status: 200, body: MANAGER_MONTH },
    ...extra,
  });
  renderApp('/planning?mois=2026-11&equipe=3');
  return { fetchMock, user: userEvent.setup() };
}

function postBody(fetchMock: jest.Mock): unknown {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      url === '/api/v1/counter-resets' && (init as RequestInit | undefined)?.method === 'POST',
  ) as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

describe('bulk counter reset', () => {
  it('is hidden from someone who may reset nobody', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/team-months/2026-11': { status: 200, body: teamMonth() },
    });
    renderApp('/planning?mois=2026-11&equipe=3');

    await screen.findByRole('table', { name: /novembre 2026/ });
    expect(
      screen.queryByRole('button', { name: copy.planning.resetButton }),
    ).not.toBeInTheDocument();
  });

  it('selects a whole team, counts it and sends the chosen people and date', async () => {
    const { user, fetchMock } = renderAsManager({
      'POST /api/v1/counter-resets': { status: 201, body: { resets: [] } },
    });

    await user.click(await screen.findByRole('button', { name: copy.planning.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.planning.resetTitle });
    expect(within(dialog).getByRole('button', { name: /Remettre 0 compteur/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('checkbox', { name: 'Tech › Front' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' }));

    expect(within(dialog).getByRole('checkbox', { name: 'Tech › Front' })).toHaveProperty(
      'indeterminate',
      true,
    );
    await user.clear(within(dialog).getByLabelText(copy.counters.resetDate));
    await user.type(within(dialog).getByLabelText(copy.counters.resetDate), '2026-11-02');
    await user.click(within(dialog).getByRole('button', { name: 'Remettre 2 compteurs à zéro' }));

    await waitFor(() =>
      expect(postBody(fetchMock)).toEqual({ userIds: [2, 7], resetDate: '2026-11-02' }),
    );
    expect(await screen.findByText('2 compteurs remis à zéro.')).toHaveAttribute('role', 'status');
    // Success refresh: the month is read a second time so the balances are current.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => url === '/api/v1/team-months/2026-11'),
      ).toHaveLength(2),
    );
  });

  it('says "1 compteur" for a single person, and clears the line on the next filter change', async () => {
    const { user } = renderAsManager({
      'POST /api/v1/counter-resets': { status: 201, body: { resets: [] } },
    });

    await user.click(await screen.findByRole('button', { name: copy.planning.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.planning.resetTitle });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' }));
    await user.click(within(dialog).getByRole('button', { name: 'Remettre 1 compteur à zéro' }));
    expect(await screen.findByText('1 compteur remis à zéro.')).toHaveAttribute('role', 'status');

    await user.click(screen.getByRole('checkbox', { name: copy.planning.absentToday }));
    await waitFor(() =>
      expect(screen.queryByText('1 compteur remis à zéro.')).not.toBeInTheDocument(),
    );
  });

  it('shows the server refusal naming the person, and resets nothing', async () => {
    const { user } = renderAsManager({
      'POST /api/v1/counter-resets': {
        status: 403,
        body: {
          code: 'COUNTER_RESET_FORBIDDEN',
          message: 'Vous ne pouvez pas remettre ce compteur à zéro. (Hugo Laurent)',
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.planning.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.planning.resetTitle });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hugo Laurent' }));
    await user.click(within(dialog).getByRole('button', { name: 'Remettre 1 compteur à zéro' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('(Hugo Laurent)');
  });

  it('only lists people the viewer may reset', async () => {
    const { user } = renderAsManager();

    await user.click(await screen.findByRole('button', { name: copy.planning.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.planning.resetTitle });

    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['Tech › Front', 'Sophie Dubois', 'Hugo Laurent', 'Léa Moreau']);
  });

  it('closes without resetting when cancelled', async () => {
    const { user, fetchMock } = renderAsManager();

    await user.click(await screen.findByRole('button', { name: copy.planning.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.planning.resetTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.counters.cancel }));

    expect(
      screen.queryByRole('dialog', { name: copy.planning.resetTitle }),
    ).not.toBeInTheDocument();
    expect(postBody(fetchMock)).toBeUndefined();
  });
});
