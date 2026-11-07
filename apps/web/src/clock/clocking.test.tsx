import { datesOfIsoWeek, toWorkDate } from '@work-planner/domain';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { APP_TIME_ZONE, currentIsoWeek, shiftIsoWeek } from './clock-time';

const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
const RUNNING_PERIOD = {
  id: 41,
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  endedAt: null,
};

function renderHome(extraRoutes: Record<string, MockResponse> = {}, todayOverrides = {}) {
  const week = weekFixture({ days: { [TODAY]: todayOverrides } });
  const fetchMock = mockFetchRoutes({ ...signedInHomeRoutes(week), ...extraRoutes });
  renderApp('/');
  return { fetchMock, user: userEvent.setup() };
}

function bodyOf(fetchMock: jest.Mock, method: string, url: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([callUrl, init]) => callUrl === url && (init as RequestInit | undefined)?.method === method,
  ) as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

describe('clocking from the week view', () => {
  it('starts the day on site, sending the CSRF token', async () => {
    const { fetchMock, user } = renderHome({
      'POST /api/v1/clock-periods': { status: 201, body: RUNNING_PERIOD },
    });

    await user.click(await screen.findByRole('button', { name: copy.clock.start }));

    expect(bodyOf(fetchMock, 'POST', '/api/v1/clock-periods')).toEqual({ workMode: 'on_site' });
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/clock-periods') as [
      string,
      RequestInit,
    ];
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-test-token' });
  });

  it('starts the day remotely when the person picks telework first', async () => {
    const { fetchMock, user } = renderHome({
      'POST /api/v1/clock-periods': { status: 201, body: RUNNING_PERIOD },
    });

    await user.click(await screen.findByRole('radio', { name: copy.clock.telework }));
    await user.click(screen.getByRole('button', { name: copy.clock.start }));

    expect(bodyOf(fetchMock, 'POST', '/api/v1/clock-periods')).toEqual({ workMode: 'telework' });
  });

  it('stops the running period', async () => {
    const { fetchMock, user } = renderHome(
      {
        [`PATCH /api/v1/clock-periods/${RUNNING_PERIOD.id}`]: {
          status: 200,
          body: { ...RUNNING_PERIOD, endedAt: new Date().toISOString() },
        },
      },
      { periods: [RUNNING_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    await user.click(await screen.findByRole('button', { name: copy.clock.stop }));

    expect(bodyOf(fetchMock, 'PATCH', `/api/v1/clock-periods/${RUNNING_PERIOD.id}`)).toEqual({
      endedAt: 'now',
    });
  });

  it('adds a forgotten period through the dialog and shows a server refusal', async () => {
    const { fetchMock, user } = renderHome({
      'POST /api/v1/clock-periods': {
        status: 409,
        body: {
          code: 'CLOCK_PERIOD_OVERLAP',
          message: 'Cette période chevauche une autre période.',
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.clock.addPeriod }));
    const dialog = screen.getByRole('dialog', { name: copy.clock.addPeriodTitle });
    await user.type(within(dialog).getByLabelText(copy.clock.startTime), '09:00');
    await user.type(within(dialog).getByLabelText(copy.clock.endTime), '12:00');
    await user.click(within(dialog).getByRole('button', { name: copy.clock.save }));

    expect(bodyOf(fetchMock, 'POST', '/api/v1/clock-periods')).toEqual({
      startedAt: '09:00',
      endedAt: '12:00',
    });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cette période chevauche une autre période.',
    );
  });

  it('edits and deletes a period of today', async () => {
    const closed = {
      id: 42,
      startedAt: new Date(Date.now() - 7_200_000).toISOString(),
      endedAt: new Date(Date.now() - 3_600_000).toISOString(),
    };
    const { fetchMock, user } = renderHome(
      { [`DELETE /api/v1/clock-periods/${closed.id}`]: { status: 204 } },
      { periods: [closed], workMode: 'on_site', workedMinutes: 60 },
    );
    const today = await screen.findByRole('listitem', { current: 'date' });

    await user.click(
      within(today)
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-label')?.includes('–')) as HTMLElement,
    );
    const dialog = screen.getByRole('dialog', { name: copy.clock.editPeriodTitle });
    await user.click(within(dialog).getByRole('button', { name: copy.clock.delete }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/clock-periods/${closed.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('closes a day left unclosed with its real end time', async () => {
    // Last week: every day is in the past, whatever weekday the test runs on.
    const isoWeek = shiftIsoWeek(currentIsoWeek(new Date()), -1);
    const thursday = datesOfIsoWeek(isoWeek)?.[3] ?? '';
    const open = { id: 43, startedAt: `${thursday}T12:00:00.000Z`, endedAt: null };
    const week = weekFixture({
      isoWeek,
      days: { [thursday]: { periods: [open], isUnclosed: true, canClose: true } },
    });
    const fetchMock = mockFetchRoutes({
      ...signedInHomeRoutes(week),
      [`PATCH /api/v1/clock-periods/${open.id}`]: {
        status: 200,
        body: { ...open, endedAt: `${thursday}T16:00:00.000Z` },
      },
    });
    renderApp(`/?semaine=${isoWeek}`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: copy.clock.closeDay }));
    const dialog = screen.getByRole('dialog', { name: copy.clock.closeDayTitle });
    await user.type(within(dialog).getByLabelText(copy.clock.endTime), '17:00');
    await user.click(within(dialog).getByRole('button', { name: copy.clock.save }));

    expect(bodyOf(fetchMock, 'PATCH', `/api/v1/clock-periods/${open.id}`)).toEqual({
      endedAt: '17:00',
    });
  });

  it("shows no clocking controls on someone else's week", async () => {
    const otherWeek = weekFixture({
      user: { id: 9, firstName: 'Hugo', lastName: 'Laurent' },
      isOwnWeek: false,
    });
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      [`GET /api/v1/users/9/clock-weeks/${otherWeek.isoWeek}`]: { status: 200, body: otherWeek },
    });

    renderApp(`/pointage/9?semaine=${otherWeek.isoWeek}`);

    expect(await screen.findByText(/Semaine de Hugo Laurent/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.clock.start })).not.toBeInTheDocument();
  });
});
