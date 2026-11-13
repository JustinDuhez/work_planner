import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { yearCalendar } from '../test/calendar-fixtures';
import { signedInHomeRoutes } from '../test/clock-fixtures';
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

  it('labels declared halves, holidays and weekends in text', async () => {
    renderCalendar('/calendrier?periode=2026');

    expect(await screen.findByText('23 nov. : Congé · matin')).toBeInTheDocument();
    expect(screen.getByText('1 déc. : Télétravail · après-midi (en attente)')).toBeInTheDocument();
    expect(screen.getByText('25 déc. : Férié · Noël')).toBeInTheDocument();
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
});
