import { formatMinutes, toLocalTime, toWorkDate } from '@work-planner/domain';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { expectNoAxeViolations } from '../test/axe';
import { HUGO, LEA, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { CLOCK_WEEK_QUERY_PREFIX, clockWeekQueryKey } from './clock-queries';
import { APP_TIME_ZONE, currentIsoWeek, shiftIsoWeek } from './clock-time';

const WEEK = '2026-W45';
// Tuesday of week 45: leave tests must not depend on the real date.
const SERVER_NOW = '2026-11-03T10:00:00.000Z';
const FULL_LEAVE = {
  am: { dayTypeCode: 'leave', status: 'approved' },
  pm: { dayTypeCode: 'leave', status: 'approved' },
} as const;

describe('ClockWeekPage', () => {
  it('shows my current week on the home screen', async () => {
    mockFetchRoutes(signedInHomeRoutes());

    renderApp('/');

    expect(await screen.findByRole('heading', { name: copy.clock.title })).toBeInTheDocument();
    expect(
      await screen.findAllByRole('listitem', { name: /^(LUN|MAR|MER|JEU|VEN|SAM|DIM)/ }),
    ).toHaveLength(7);
  });

  it('shows each day total and the week total', async () => {
    const week = weekFixture({
      isoWeek: WEEK,
      days: {
        '2026-11-02': { workedMinutes: 420, workMode: 'on_site' },
        '2026-11-03': { workedMinutes: 390 },
      },
      counters: { weekCountedWorkedMinutes: 810 },
    });
    mockFetchRoutes(signedInHomeRoutes(week));

    renderApp(`/?semaine=${WEEK}`);

    const monday = await screen.findByRole('listitem', { name: /^LUN 2/ });
    expect(within(monday).getByText('7:00')).toBeInTheDocument();
    expect(screen.getByText(copy.counters.worked).parentElement).toHaveTextContent('13:30');
  });

  it('has no accessibility violations on a loaded week', async () => {
    mockFetchRoutes(signedInHomeRoutes());
    const { queryClient, container } = renderApp('/');

    await screen.findByRole('region', { name: copy.clock.todayTitle });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('warns about a day left unclosed', async () => {
    const week = weekFixture({ isoWeek: WEEK, days: { '2026-11-05': { isUnclosed: true } } });
    mockFetchRoutes(signedInHomeRoutes(week));

    renderApp(`/?semaine=${WEEK}`);

    const thursday = await screen.findByRole('listitem', { name: /^JEU 5/ });
    expect(within(thursday).getByText(copy.clock.unclosed)).toBeInTheDocument();
  });

  it('moves to the next week and keeps it in the URL', async () => {
    const next = shiftIsoWeek(WEEK, 1);
    mockFetchRoutes({
      ...signedInHomeRoutes(weekFixture({ isoWeek: WEEK })),
      [`GET /api/v1/users/${LEA.id}/clock-weeks/${next}`]: {
        status: 200,
        body: weekFixture({ isoWeek: next }),
      },
    });
    const { router } = renderApp(`/?semaine=${WEEK}`);
    const nextWeekButton = await screen.findByRole('button', { name: copy.clock.nextWeek });

    await userEvent.setup().click(nextWeekButton);

    expect(await screen.findByText('S46')).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?semaine=${next}`);
    // The sticky bar is not rebuilt with the week: keyboard users keep their place on it.
    expect(nextWeekButton).toHaveFocus();
  });

  it("opens a colleague's week from the person picker, read-only", async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(weekFixture({ isoWeek: WEEK })),
      [`GET /api/v1/users/${HUGO.id}/clock-weeks/${WEEK}`]: {
        status: 200,
        body: weekFixture({ isoWeek: WEEK, user: HUGO, isOwnWeek: false }),
      },
    });
    const { router } = renderApp(`/?semaine=${WEEK}`);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(copy.clock.searchPerson), 'Hug');
    await user.click(screen.getByRole('link', { name: /Hugo Laurent/ }));

    expect(await screen.findByText(/Semaine de Hugo Laurent/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/pointage/${HUGO.id}`);
  });

  it('falls back to the current week when the URL week is invalid', async () => {
    mockFetchRoutes(signedInHomeRoutes());

    renderApp('/?semaine=foo');

    expect(
      await screen.findAllByRole('listitem', { name: /^(LUN|MAR|MER|JEU|VEN|SAM|DIM)/ }),
    ).toHaveLength(7);
  });

  it('shows the not found page for a malformed person in the URL', async () => {
    mockFetchRoutes(signedInHomeRoutes());

    renderApp('/pointage/abc');

    expect(await screen.findByText(copy.notFound.title)).toBeInTheDocument();
  });

  it('says so when the week cannot be loaded and loads it again on demand', async () => {
    const weekUrl = `/api/v1/users/${LEA.id}/clock-weeks/${WEEK}`;
    const fetchMock = mockFetchRoutes({
      ...signedInHomeRoutes(weekFixture({ isoWeek: WEEK })),
      [`GET ${weekUrl}`]: { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Oups' } },
    });
    const { queryClient, container } = renderApp(`/?semaine=${WEEK}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.clock.loadError);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: copy.states.retry }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === weekUrl)).toHaveLength(2),
    );
  });

  it('shows the shape of the week while it loads', async () => {
    mockFetchRoutes(signedInHomeRoutes());
    const answer = globalThis.fetch;
    // The week never answers: the page stays on its placeholder.
    globalThis.fetch = (input, init) =>
      typeof input === 'string' && input.includes('/clock-weeks/')
        ? new Promise<Response>(() => undefined)
        : answer(input, init);

    renderApp('/');

    const label = await screen.findByText(copy.clock.loading);
    expect(label).toHaveClass('sr-only');
    expect(label.closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryAllByRole('listitem', { name: /^(LUN|MAR|MER|JEU|VEN|SAM|DIM)/ })).toEqual(
      [],
    );
  });

  describe('today card', () => {
    const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
    const ONE_HOUR_IN_MILLISECONDS = 3_600_000;

    it('comes first with the time worked today and one primary Start button', async () => {
      const done = {
        id: 1,
        startedAt: new Date(Date.now() - 2 * ONE_HOUR_IN_MILLISECONDS).toISOString(),
        endedAt: new Date(Date.now() - ONE_HOUR_IN_MILLISECONDS).toISOString(),
      };
      const week = weekFixture({ days: { [TODAY]: { periods: [done], workMode: 'on_site' } } });
      mockFetchRoutes(signedInHomeRoutes(week));

      renderApp('/');

      const hero = await screen.findByRole('region', { name: copy.clock.todayTitle });
      expect(screen.getAllByRole('region')[0]).toBe(hero);
      expect(within(hero).getByText(formatMinutes(60))).toBeInTheDocument();
      const start = within(hero).getByRole('button', { name: copy.clock.start });
      expect(start).toHaveClass('bg-primary-600');
      expect(
        within(hero)
          .getAllByRole('button')
          .filter((button) => button.classList.contains('bg-primary-600')),
      ).toEqual([start]);
      expect(start.closest('.fixed')).toBeNull();
      expect(within(hero).queryByText(new RegExp(`^${copy.clock.since} `))).toBeNull();
      const todayRow = screen.getByRole('listitem', { current: 'date' });
      expect(within(todayRow).queryByRole('button', { name: copy.clock.start })).toBeNull();
    });

    it('offers Stop in the same spot while a period runs, with its start and mode', async () => {
      const startedAt = new Date(Date.now() - ONE_HOUR_IN_MILLISECONDS);
      const running = { id: 2, startedAt: startedAt.toISOString(), endedAt: null };
      const week = weekFixture({ days: { [TODAY]: { periods: [running], workMode: 'telework' } } });
      mockFetchRoutes(signedInHomeRoutes(week));

      renderApp('/');

      const hero = await screen.findByRole('region', { name: copy.clock.todayTitle });
      expect(within(hero).getByRole('button', { name: copy.clock.stop })).toHaveClass(
        'bg-primary-600',
      );
      expect(
        within(hero).getByText(
          `${copy.clock.since} ${toLocalTime(startedAt, APP_TIME_ZONE)} · ${copy.clock.telework}`,
        ),
      ).toBeInTheDocument();
    });

    it('tells in its status line that a Stop in the same minute cancelled the period', async () => {
      const running = { id: 3, startedAt: new Date().toISOString(), endedAt: null };
      const week = weekFixture({ days: { [TODAY]: { periods: [running], workMode: 'on_site' } } });
      mockFetchRoutes({
        ...signedInHomeRoutes(week),
        'PATCH /api/v1/clock-periods/3': { status: 204 },
      });
      renderApp('/');

      const hero = await screen.findByRole('region', { name: copy.clock.todayTitle });
      const status = within(hero).getByRole('status');
      expect(status).toBeEmptyDOMElement();
      await userEvent.setup().click(within(hero).getByRole('button', { name: copy.clock.stop }));

      await waitFor(() => expect(status).toHaveTextContent(copy.clock.periodCancelled));
    });

    it('is not shown on a past week', async () => {
      const lastWeek = shiftIsoWeek(currentIsoWeek(new Date()), -1);
      mockFetchRoutes(signedInHomeRoutes(weekFixture({ isoWeek: lastWeek })));

      renderApp(`/?semaine=${lastWeek}`);

      expect(await screen.findAllByRole('listitem', { name: /^LUN/ })).toHaveLength(1);
      expect(screen.queryByRole('region', { name: copy.clock.todayTitle })).toBeNull();
      // Without a hero, the absence request stays on its own above the rows.
      expect(screen.getByRole('button', { name: copy.leave.requestButton })).toBeInTheDocument();
    });

    it("is not shown on a colleague's current week", async () => {
      const other = weekFixture({ user: HUGO, isOwnWeek: false });
      mockFetchRoutes({
        ...signedInHomeRoutes(),
        [`GET /api/v1/users/${HUGO.id}/clock-weeks/${other.isoWeek}`]: { status: 200, body: other },
      });

      renderApp(`/pointage/${HUGO.id}`);

      expect(await screen.findByText(/Semaine de Hugo Laurent/)).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: copy.clock.todayTitle })).toBeNull();
    });

    it("groups the absence request with the hero's secondary actions", async () => {
      mockFetchRoutes(signedInHomeRoutes());

      renderApp('/');

      const hero = await screen.findByRole('region', { name: copy.clock.todayTitle });
      const request = within(hero).getByRole('button', { name: copy.leave.requestButton });
      expect(request).not.toHaveClass('bg-primary-600');
      expect(request.parentElement).toBe(
        within(hero).getByRole('button', { name: copy.clock.addPeriod }).parentElement,
      );
      expect(screen.getAllByRole('button', { name: copy.leave.requestButton })).toEqual([request]);
    });
  });

  it('keeps the week on screen when a background refresh fails', async () => {
    const week = weekFixture({ isoWeek: WEEK });
    mockFetchRoutes(signedInHomeRoutes(week));
    const { queryClient } = renderApp(`/?semaine=${WEEK}`);
    await screen.findAllByRole('listitem', { name: /^LUN/ });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    mockFetchRoutes({
      ...signedInHomeRoutes(week),
      [`GET /api/v1/users/${LEA.id}/clock-weeks/${WEEK}`]: {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Oups' },
      },
    });

    await act(() => queryClient.refetchQueries({ queryKey: CLOCK_WEEK_QUERY_PREFIX }));
    // TanStack Query tells its observers on the next macrotask: let the page render the failure.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(queryClient.getQueryState(clockWeekQueryKey(LEA.id, WEEK))?.status).toBe('error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { name: /^LUN/ })).toHaveLength(1);
  });

  it('offers the owner to declare an absence on a future weekday and opens the dialog', async () => {
    const week = weekFixture({
      isoWeek: WEEK,
      serverNow: SERVER_NOW,
      days: {
        '2026-11-04': { isFuture: true, isToday: false },
        '2026-11-05': { isFuture: true, isToday: false, holidayLabel: 'Férié' },
        '2026-11-06': { isFuture: true, isToday: false, halfDays: FULL_LEAVE },
        '2026-11-07': { isFuture: true, isToday: false },
        '2026-11-03': { isFuture: false, isToday: false },
      },
    });
    mockFetchRoutes(signedInHomeRoutes(week));
    renderApp(`/?semaine=${WEEK}`);
    const user = userEvent.setup();

    const wednesday = await screen.findByRole('listitem', { name: /^MER 4/ });
    expect(
      within(screen.getByRole('listitem', { name: /^MAR 3/ })).queryByRole('button', {
        name: copy.leave.declareDay,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: /^JEU 5/ })).queryByRole('button', {
        name: copy.leave.declareDay,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: /^VEN 6/ })).queryByRole('button', {
        name: copy.leave.declareDay,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: /^SAM 7/ })).queryByRole('button', {
        name: copy.leave.declareDay,
      }),
    ).not.toBeInTheDocument();
    await user.click(within(wednesday).getByRole('button', { name: copy.leave.declareDay }));

    expect(await screen.findByRole('dialog', { name: copy.leave.dialogTitle })).toBeInTheDocument();
  });

  it('opens the request dialog from the week-level button', async () => {
    mockFetchRoutes(signedInHomeRoutes(weekFixture({ isoWeek: WEEK, serverNow: SERVER_NOW })));
    renderApp(`/?semaine=${WEEK}`);

    const user = userEvent.setup();
    const opener = await screen.findByRole('button', { name: copy.leave.requestButton });
    await user.click(opener);

    const dialog = await screen.findByRole('dialog', { name: copy.leave.dialogTitle });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.leave.cancel }));
    expect(opener).toHaveFocus();
  });

  it("shows a colleague's planned half-days but no request buttons", async () => {
    const other = weekFixture({
      isoWeek: WEEK,
      user: HUGO,
      isOwnWeek: false,
      serverNow: SERVER_NOW,
      days: { '2026-11-04': { isFuture: true, isToday: false, halfDays: FULL_LEAVE } },
    });
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      [`GET /api/v1/users/${HUGO.id}/clock-weeks/${WEEK}`]: { status: 200, body: other },
    });
    renderApp(`/pointage/${HUGO.id}?semaine=${WEEK}`);

    expect(await screen.findByText('Congé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.leave.declareDay })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.leave.requestButton }),
    ).not.toBeInTheDocument();
  });

  describe('across Sunday midnight', () => {
    const SUNDAY_NIGHT = '2026-11-15T22:59:30.000Z'; // 23:59:30 in Paris, week 46
    const ONE_MINUTE_IN_MILLISECONDS = 60_000;

    function renderSundayNight(path: string) {
      jest.useFakeTimers({
        now: new Date(SUNDAY_NIGHT),
        doNotFake: ['queueMicrotask', 'nextTick'],
      });
      const fetchMock = mockFetchRoutes({
        ...signedInHomeRoutes(weekFixture({ isoWeek: '2026-W46', serverNow: SUNDAY_NIGHT })),
        [`GET /api/v1/users/${LEA.id}/clock-weeks/2026-W47`]: {
          status: 200,
          body: weekFixture({ isoWeek: '2026-W47', serverNow: '2026-11-16T00:00:30.000+01:00' }),
        },
      });
      renderApp(path);
      return fetchMock;
    }

    afterEach(() => jest.useRealTimers());

    it('moves to the new week when no week was asked for', async () => {
      const fetchMock = renderSundayNight('/');
      expect(await screen.findByText('S46')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(ONE_MINUTE_IN_MILLISECONDS);
      });

      expect(await screen.findByText('S47')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/users/${LEA.id}/clock-weeks/2026-W47`,
        expect.anything(),
      );
    });

    it('settles on the server week when the computer clock is already in the next week', async () => {
      const serverNow = '2026-11-15T22:59:00.000Z'; // 23:59 in Paris, week 46
      const ninetySecondsAhead = new Date('2026-11-15T23:00:30.000Z'); // 00:00:30, week 47
      jest.useFakeTimers({ now: ninetySecondsAhead, doNotFake: ['queueMicrotask', 'nextTick'] });
      const fetchMock = mockFetchRoutes({
        ...signedInHomeRoutes(weekFixture({ isoWeek: '2026-W46', serverNow })),
        [`GET /api/v1/users/${LEA.id}/clock-weeks/2026-W47`]: {
          status: 200,
          body: weekFixture({ isoWeek: '2026-W47', serverNow }),
        },
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      renderApp('/');

      expect(await screen.findByText('S46')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(screen.getByText('S46')).toBeInTheDocument();
      const weekFetches = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/clock-weeks/'),
      );
      expect(weekFetches.length).toBeLessThanOrEqual(2);
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('keeps the week that was asked for', async () => {
      renderSundayNight('/?semaine=2026-W46');
      expect(await screen.findByText('S46')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(ONE_MINUTE_IN_MILLISECONDS);
      });

      expect(screen.getByText('S46')).toBeInTheDocument();
    });
  });
});
