import { toWorkDate } from '@work-planner/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { HUGO, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { APP_TIME_ZONE } from './clock-time';

const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
const RESET = {
  id: 5,
  resetDate: TODAY,
  authorName: 'Léa Moreau',
  createdAt: new Date().toISOString(),
};

function renderHugoWeek(canResetCounter: boolean, extraRoutes: Record<string, MockResponse> = {}) {
  const week = weekFixture({
    user: HUGO,
    isOwnWeek: false,
    counters: { canResetCounter, startDate: '2026-10-12' },
  });
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    [`GET /api/v1/users/${HUGO.id}/clock-weeks/${week.isoWeek}`]: { status: 200, body: week },
    ...extraRoutes,
  });
  renderApp(`/pointage/${HUGO.id}?semaine=${week.isoWeek}`);
  return { fetchMock, user: userEvent.setup() };
}

function sentBody(fetchMock: jest.Mock, url: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([callUrl, init]) => callUrl === url && (init as RequestInit | undefined)?.method === 'POST',
  ) as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

describe('resetting a counter', () => {
  it('hides the reset button from someone who may not reset', async () => {
    renderHugoWeek(false);

    expect(await screen.findByText(copy.counters.globalTitle)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.counters.resetButton }),
    ).not.toBeInTheDocument();
  });

  it('resets from the chosen date, sending the CSRF token', async () => {
    const url = `/api/v1/users/${HUGO.id}/counter-resets`;
    const { fetchMock, user } = renderHugoWeek(true, {
      [`POST ${url}`]: { status: 201, body: RESET },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.resetTitle });
    expect(within(dialog).getByLabelText(copy.counters.resetDate)).toHaveValue(TODAY);
    expect(
      within(dialog).getByText(new RegExp(`${HUGO.firstName} ${HUGO.lastName}`)),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.counters.resetConfirm }));

    expect(sentBody(fetchMock, url)).toEqual({ resetDate: TODAY });
    const [, init] = fetchMock.mock.calls.find(([callUrl]) => callUrl === url) as [
      string,
      RequestInit,
    ];
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-test-token' });
  });

  it('shows a server refusal in the dialog', async () => {
    const url = `/api/v1/users/${HUGO.id}/counter-resets`;
    const { user } = renderHugoWeek(true, {
      [`POST ${url}`]: {
        status: 400,
        body: {
          code: 'COUNTER_RESET_DATE_BEFORE_START',
          message: "La date de remise à zéro ne peut pas précéder la date d'arrivée.",
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.resetTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.counters.resetConfirm }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "ne peut pas précéder la date d'arrivée",
    );
  });

  it('shows a field error under the date', async () => {
    const url = `/api/v1/users/${HUGO.id}/counter-resets`;
    const { user } = renderHugoWeek(true, {
      [`POST ${url}`]: {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Certains champs sont invalides.',
          fieldErrors: { resetDate: 'Date invalide.' },
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.resetTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.counters.resetConfirm }));

    expect(await within(dialog).findByText('Date invalide.')).toBeInTheDocument();
  });

  it('lists the reset history', async () => {
    const { user } = renderHugoWeek(true, {
      [`GET /api/v1/users/${HUGO.id}/counter-resets`]: {
        status: 200,
        body: [
          {
            id: 6,
            resetDate: '2026-11-03',
            authorName: 'Sophie Dubois',
            createdAt: '2026-11-03T09:15:00.000Z',
          },
        ],
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.historyButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.historyTitle });

    expect(await within(dialog).findByText('3 nov. 2026')).toBeInTheDocument();
    expect(
      within(dialog).getByText('par Sophie Dubois le 3 nov. 2026 à 10:15'),
    ).toBeInTheDocument();
  });

  it('closes the dialog and reloads the week after a reset', async () => {
    const url = `/api/v1/users/${HUGO.id}/counter-resets`;
    const { fetchMock, user } = renderHugoWeek(true, {
      [`POST ${url}`]: { status: 201, body: RESET },
    });
    const weekCalls = () =>
      fetchMock.mock.calls.filter(([callUrl]) => /clock-weeks/.test(callUrl as string)).length;

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    expect(weekCalls()).toBe(1);
    const dialog = screen.getByRole('dialog', { name: copy.counters.resetTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.counters.resetConfirm }));

    await waitFor(() => expect(weekCalls()).toBeGreaterThanOrEqual(2));
    expect(
      screen.queryByRole('dialog', { name: copy.counters.resetTitle }),
    ).not.toBeInTheDocument();
  });

  it('bounds the date between the start date and today', async () => {
    const { user } = renderHugoWeek(true);

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    const input = within(
      screen.getByRole('dialog', { name: copy.counters.resetTitle }),
    ).getByLabelText(copy.counters.resetDate);

    expect(input).toHaveAttribute('min', '2026-10-12');
    expect(input).toHaveAttribute('max', TODAY);
  });

  it('shows an ellipsis in the confirmation when the date is cleared', async () => {
    const { user } = renderHugoWeek(true);

    await user.click(await screen.findByRole('button', { name: copy.counters.resetButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.resetTitle });
    await user.clear(within(dialog).getByLabelText(copy.counters.resetDate));

    expect(
      within(dialog).getByText(new RegExp(`${copy.counters.resetSentenceMiddle} …\\.$`)),
    ).toBeInTheDocument();
  });

  it('says so when there is no reset yet', async () => {
    const { user } = renderHugoWeek(true, {
      [`GET /api/v1/users/${HUGO.id}/counter-resets`]: { status: 200, body: [] },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.historyButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.historyTitle });

    expect(await within(dialog).findByText(copy.counters.historyEmpty)).toBeInTheDocument();
  });

  it('shows an error when the history cannot be loaded', async () => {
    const { user } = renderHugoWeek(true, {
      [`GET /api/v1/users/${HUGO.id}/counter-resets`]: {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Erreur.' },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.counters.historyButton }));
    const dialog = screen.getByRole('dialog', { name: copy.counters.historyTitle });

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(copy.counters.loadError);
  });
});
