import { datesOfIsoWeek, toLocalTime, toWorkDate } from '@work-planner/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { HUGO, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { APP_TIME_ZONE, currentIsoWeek, shiftIsoWeek } from './clock-time';

const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
const RUNNING_PERIOD = {
  id: 41,
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  endedAt: null,
};

const CLOSED_PERIOD = {
  id: 42,
  startedAt: new Date(Date.now() - 7_200_000).toISOString(),
  endedAt: new Date(Date.now() - 3_600_000).toISOString(),
};
const CLOSED_START = toLocalTime(new Date(CLOSED_PERIOD.startedAt), APP_TIME_ZONE);
const CLOSED_END = toLocalTime(new Date(CLOSED_PERIOD.endedAt), APP_TIME_ZONE);

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

  it('adds a period with a start time only', async () => {
    const { fetchMock, user } = renderHome({
      'POST /api/v1/clock-periods': { status: 201, body: RUNNING_PERIOD },
    });

    await user.click(await screen.findByRole('button', { name: copy.clock.addPeriod }));
    const dialog = screen.getByRole('dialog', { name: copy.clock.addPeriodTitle });
    await user.type(within(dialog).getByLabelText(copy.clock.startTime), '09:00');
    await user.click(within(dialog).getByRole('button', { name: copy.clock.save }));

    expect(bodyOf(fetchMock, 'POST', '/api/v1/clock-periods')).toEqual({ startedAt: '09:00' });
  });

  it('pre-selects telework when the day is planned as approved telework', async () => {
    renderHome({}, { halfDays: { am: { dayTypeCode: 'telework', status: 'approved' }, pm: null } });

    expect(await screen.findByRole('radio', { name: copy.clock.telework })).toBeChecked();
  });

  it('switches the work mode once the day has started', async () => {
    const { fetchMock, user } = renderHome(
      {
        [`PATCH /api/v1/clock-days/${TODAY}`]: {
          status: 200,
          body: { date: TODAY, workMode: 'telework' },
        },
      },
      { periods: [CLOSED_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    await user.click(await screen.findByRole('radio', { name: copy.clock.telework }));

    expect(bodyOf(fetchMock, 'PATCH', `/api/v1/clock-days/${TODAY}`)).toEqual({
      workMode: 'telework',
    });
  });

  it('drops a failed work-mode switch message once a later stop succeeds', async () => {
    const { user } = renderHome(
      {
        [`PATCH /api/v1/clock-days/${TODAY}`]: {
          status: 409,
          body: { code: 'CLOCK_DAY_LOCKED', message: 'Changement de mode refusé.' },
        },
        [`PATCH /api/v1/clock-periods/${RUNNING_PERIOD.id}`]: {
          status: 200,
          body: { ...RUNNING_PERIOD, endedAt: new Date().toISOString() },
        },
      },
      { periods: [RUNNING_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    await user.click(await screen.findByRole('radio', { name: copy.clock.telework }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Changement de mode refusé.');
    await user.click(screen.getByRole('button', { name: copy.clock.stop }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not let a closed period be saved without its end', async () => {
    const { fetchMock, user } = renderHome(
      { [`PATCH /api/v1/clock-periods/${CLOSED_PERIOD.id}`]: { status: 200, body: CLOSED_PERIOD } },
      { periods: [CLOSED_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    const dialog = await openClosedPeriodDialog(user);
    await user.clear(within(dialog).getByLabelText(copy.clock.endTime));
    await user.click(within(dialog).getByRole('button', { name: copy.clock.save }));

    expect(within(dialog).getByLabelText(copy.clock.endTime)).toBeRequired();
    expect(within(dialog).queryByText(copy.clock.endTimeHint)).not.toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PATCH', `/api/v1/clock-periods/${CLOSED_PERIOD.id}`)).toBeUndefined();
  });

  async function openClosedPeriodDialog(user: ReturnType<typeof userEvent.setup>) {
    const today = await screen.findByRole('listitem', { current: 'date' });
    await user.click(
      within(today).getByRole('button', { name: `${CLOSED_START} – ${CLOSED_END}` }),
    );
    return screen.getByRole('dialog', { name: copy.clock.editPeriodTitle });
  }

  it('edits a period of today from its current times', async () => {
    const { fetchMock, user } = renderHome(
      { [`PATCH /api/v1/clock-periods/${CLOSED_PERIOD.id}`]: { status: 200, body: CLOSED_PERIOD } },
      { periods: [CLOSED_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    const dialog = await openClosedPeriodDialog(user);
    const startInput = within(dialog).getByLabelText(copy.clock.startTime);
    expect(startInput).toHaveValue(CLOSED_START);
    expect(within(dialog).getByLabelText(copy.clock.endTime)).toHaveValue(CLOSED_END);
    await user.clear(startInput);
    await user.type(startInput, '06:15');
    await user.click(within(dialog).getByRole('button', { name: copy.clock.save }));

    expect(bodyOf(fetchMock, 'PATCH', `/api/v1/clock-periods/${CLOSED_PERIOD.id}`)).toEqual({
      startedAt: '06:15',
      endedAt: CLOSED_END,
    });
  });

  it('deletes a period of today', async () => {
    const { fetchMock, user } = renderHome(
      { [`DELETE /api/v1/clock-periods/${CLOSED_PERIOD.id}`]: { status: 204 } },
      { periods: [CLOSED_PERIOD], workMode: 'on_site', workedMinutes: 60 },
    );

    const dialog = await openClosedPeriodDialog(user);
    await user.click(within(dialog).getByRole('button', { name: copy.clock.delete }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/clock-periods/${CLOSED_PERIOD.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it("offers a manager the correction of someone else's unclosed day", async () => {
    const isoWeek = shiftIsoWeek(currentIsoWeek(new Date()), -1);
    const thursday = datesOfIsoWeek(isoWeek)?.[3] ?? '';
    const open = { id: 44, startedAt: `${thursday}T12:00:00.000Z`, endedAt: null };
    const week = weekFixture({
      isoWeek,
      user: HUGO,
      isOwnWeek: false,
      days: {
        [thursday]: { periods: [open], isUnclosed: true, canClose: false, canCorrect: true },
      },
    });
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      [`GET /api/v1/users/${HUGO.id}/clock-weeks/${isoWeek}`]: { status: 200, body: week },
    });
    renderApp(`/pointage/${HUGO.id}?semaine=${isoWeek}`);

    expect(
      await screen.findByRole('button', { name: copy.corrections.correctDay }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.clock.closeDay })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.clock.start })).not.toBeInTheDocument();
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
