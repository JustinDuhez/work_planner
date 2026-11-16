import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { yearCalendar } from '../test/calendar-fixtures';
import { DAY_TYPE_CHIP_CLASSES } from '../leave/half-day-chips';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { expectNoAxeViolations } from '../test/axe';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

const CALENDAR = yearCalendar({
  halfDays: [
    { date: '2026-11-23', half: 'am', dayTypeCode: 'leave', status: 'approved', leaveRequestId: 4 },
    { date: '2026-11-23', half: 'pm', dayTypeCode: 'leave', status: 'approved', leaveRequestId: 4 },
    {
      date: '2026-12-01',
      half: 'pm',
      dayTypeCode: 'telework',
      status: 'pending',
      leaveRequestId: 5,
    },
  ],
  holidays: [{ date: '2026-12-25', label: 'Noël' }],
  summary: [
    { dayTypeCode: 'telework', approvedHalfDays: 0, pendingHalfDays: 1 },
    { dayTypeCode: 'leave', approvedHalfDays: 2, pendingHalfDays: 0 },
  ],
  holidayCount: 1,
});

function renderCalendar(path: string, extra: Record<string, MockResponse> = {}) {
  mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: CALENDAR },
    'GET /api/v1/settings': { status: 200, body: { yearStart: '07-01' } },
    ...extra,
  });
  const rendered = renderApp(path);
  return { ...rendered, user: userEvent.setup() };
}

describe('YearCalendarPage', () => {
  it('shows the 12 months of the period, Monday first', async () => {
    renderCalendar('/calendrier?periode=2026');

    const months = await screen.findAllByRole('table', { name: /\d{4}$/ });

    expect(months).toHaveLength(12);
    expect(months[0]).toHaveAccessibleName('juillet 2026');
    expect(
      within(months[0] as HTMLElement)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  it('labels declared halves and holidays in text and colors them by status and weekend', async () => {
    renderCalendar('/calendrier?periode=2026');

    expect(await screen.findByText('23 nov. : Congé · matin')).toBeInTheDocument();
    expect(screen.getByText('1 déc. : Télétravail · après-midi (en attente)')).toBeInTheDocument();
    expect(screen.getByText('25 déc. : Férié · Noël')).toBeInTheDocument();
    expect(screen.getByText('23 nov. : Congé · matin').parentElement).toHaveClass(
      ...DAY_TYPE_CHIP_CLASSES['leave']!.approved.split(' '),
    );
    expect(
      screen.getByText('1 déc. : Télétravail · après-midi (en attente)').parentElement,
    ).toHaveClass(...DAY_TYPE_CHIP_CLASSES['telework']!.pending.split(' '));
    // Saturday 21 November: the day number sits next to its two halves.
    const november = screen.getByRole('table', { name: 'novembre 2026' });
    const saturday = within(november).getByText('21').parentElement;
    expect(saturday?.children[1]).toHaveClass('bg-zinc-100');
    expect(saturday?.children[2]).toHaveClass('bg-zinc-100');
  });

  it('summarizes the usage of the period', async () => {
    renderCalendar('/calendrier?periode=2026');

    const summary = await screen.findByRole('region', { name: copy.calendar.summaryTitle });

    expect(
      within(summary).getByText('Télétravail · 0 jour (+0,5 jour en attente)'),
    ).toBeInTheDocument();
    expect(within(summary).getByText('Congé · 1 jour')).toBeInTheDocument();
    expect(within(summary).getByText('Jours fériés · 1')).toBeInTheDocument();
  });

  it('says when nothing is declared', async () => {
    renderCalendar('/calendrier?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: yearCalendar() },
    });

    expect(await screen.findByText(copy.calendar.noAbsence)).toBeInTheDocument();
  });

  it('moves to the next period in the URL', async () => {
    const { user, router } = renderCalendar('/calendrier?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2027': {
        status: 200,
        body: yearCalendar({ period: { startDate: '2027-07-01', endDate: '2028-06-30' } }),
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.calendar.nextPeriod }));

    expect(router.state.location.search).toBe('?periode=2027');
  });

  it("opens someone else's calendar from the URL", async () => {
    renderCalendar('/calendrier/9?periode=2026', {
      'GET /api/v1/users/9/year-calendars/2026': {
        status: 200,
        body: yearCalendar({ user: { id: 9, firstName: 'Hugo', lastName: 'Laurent' } }),
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Calendrier de Hugo Laurent' }),
    ).toBeInTheDocument();
  });

  it('has a Calendrier link in the header', async () => {
    renderCalendar('/calendrier?periode=2026');

    expect(await screen.findByRole('link', { name: copy.nav.calendar })).toHaveAttribute(
      'href',
      '/calendrier',
    );
  });

  it('marks today for assistive technology', async () => {
    renderCalendar('/calendrier?periode=2026');

    await screen.findAllByRole('table');

    expect(screen.getByRole('cell', { current: 'date' })).toHaveTextContent('13');
  });

  it('stops the period arrows at the supported years', async () => {
    renderCalendar('/calendrier?periode=2100', {
      'GET /api/v1/users/7/year-calendars/2100': {
        status: 200,
        body: yearCalendar({ period: { startDate: '2100-07-01', endDate: '2101-06-30' } }),
      },
    });

    expect(await screen.findByRole('button', { name: copy.calendar.nextPeriod })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.calendar.previousPeriod })).toBeEnabled();
  });

  it('stops the previous arrow at the first supported year', async () => {
    renderCalendar('/calendrier?periode=2000', {
      'GET /api/v1/users/7/year-calendars/2000': {
        status: 200,
        body: yearCalendar({ period: { startDate: '2000-07-01', endDate: '2001-06-30' } }),
      },
    });

    expect(
      await screen.findByRole('button', { name: copy.calendar.previousPeriod }),
    ).toBeDisabled();
  });

  it('requests an absence for yourself from the top bar, starting today', async () => {
    const { user } = renderCalendar('/calendrier?periode=2026');

    await user.click(await screen.findByRole('button', { name: copy.leave.requestButton }));

    const dialog = screen.getByRole('dialog', { name: copy.leave.dialogTitle });
    expect(within(dialog).getByLabelText(copy.leave.startDate)).toHaveValue('2026-11-13');
  });

  it("offers no top bar request on someone else's calendar", async () => {
    renderCalendar('/calendrier/9?periode=2026', {
      'GET /api/v1/users/9/year-calendars/2026': {
        status: 200,
        body: yearCalendar({ user: { id: 9, firstName: 'Hugo', lastName: 'Laurent' } }),
      },
    });

    await screen.findByRole('heading', { name: 'Calendrier de Hugo Laurent' });
    expect(
      screen.queryByRole('button', { name: copy.leave.requestButton }),
    ).not.toBeInTheDocument();
  });

  it('keeps the holiday text on a half-day declared on a public holiday', async () => {
    renderCalendar('/calendrier?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': {
        status: 200,
        body: yearCalendar({
          halfDays: [
            {
              date: '2026-12-25',
              half: 'am',
              dayTypeCode: 'leave',
              status: 'approved',
              leaveRequestId: 4,
            },
          ],
          holidays: [{ date: '2026-12-25', label: 'Noël' }],
        }),
      },
    });

    expect(await screen.findByText('25 déc. : Congé · matin')).toBeInTheDocument();
    expect(screen.getByText('25 déc. : Férié · Noël')).toBeInTheDocument();
  });

  it('says today in text on the cell of today', async () => {
    renderCalendar('/calendrier?periode=2026');

    const november = await screen.findByRole('table', { name: 'novembre 2026' });
    const today = november.querySelector('td[aria-current="date"]') as HTMLElement;

    expect(within(today).getByText(copy.calendar.today)).toHaveClass('sr-only');
  });

  it('shows the shape of the calendar while it loads', async () => {
    renderCalendar('/calendrier?periode=2026');
    const answer = globalThis.fetch;
    globalThis.fetch = (input, init) =>
      typeof input === 'string' && input.includes('/year-calendars/')
        ? new Promise<Response>(() => undefined)
        : answer(input, init);

    renderApp('/calendrier?periode=2026');

    const label = await screen.findByText(copy.calendar.loading);
    expect(label).toHaveClass('sr-only');
    expect(label.closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('says so when the calendar cannot be loaded and loads it again on demand', async () => {
    const url = '/api/v1/users/7/year-calendars/2026';
    const fetchMock = mockFetchRoutes({
      ...signedInHomeRoutes(),
      [`GET ${url}`]: { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Oups' } },
    });
    const { queryClient, container } = renderApp('/calendrier?periode=2026');

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.calendar.loadError);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: copy.states.retry }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === url)).toHaveLength(2));
  });

  it('has no accessibility violation once loaded', async () => {
    const { queryClient, container } = renderCalendar('/calendrier?periode=2026');

    await screen.findByRole('table', { name: 'novembre 2026' });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });
});
