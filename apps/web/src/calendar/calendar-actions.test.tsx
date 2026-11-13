import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { yearCalendar } from '../test/calendar-fixtures';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { DAY_TYPES, leaveRequestView } from '../test/leave-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const MANAGER_SESSION = {
  ...SIGNED_IN_SESSION,
  user: {
    ...SIGNED_IN_SESSION.user,
    id: 2,
    firstName: 'Sophie',
    lastName: 'Dubois',
    roles: { isAdmin: false, isManager: true },
  },
};
const LEA_CALENDAR = yearCalendar({
  canDeclare: true,
  halfDays: [
    { date: '2026-11-23', half: 'am', dayTypeCode: 'leave', status: 'approved', leaveRequestId: 4 },
  ],
});

function renderAs(session: unknown, path: string, extra: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/me': { status: 200, body: session },
    'GET /api/v1/day-types': { status: 200, body: DAY_TYPES },
    'GET /api/v1/settings': { status: 200, body: { yearStart: '07-01' } },
    ...extra,
  });
  renderApp(path);
  return { fetchMock, user: userEvent.setup() };
}

function findCall(fetchMock: jest.Mock, method: string, url: string) {
  return fetchMock.mock.calls.find(
    ([callUrl, init]) => callUrl === url && (init as RequestInit | undefined)?.method === method,
  ) as [string, RequestInit] | undefined;
}

describe('calendar actions', () => {
  it('declares an absence for a team member from a free half-day, past included', async () => {
    const { user, fetchMock } = renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: LEA_CALENDAR },
      'POST /api/v1/users/7/leave-requests': {
        status: 201,
        body: leaveRequestView({ id: 9, status: 'approved' }),
      },
    });

    await user.click(await screen.findByRole('button', { name: /^3 nov\. : matin/ }));
    const dialog = screen.getByRole('dialog', { name: 'Déclarer une absence pour Léa Moreau' });
    await user.selectOptions(await within(dialog).findByLabelText(copy.leave.type), 'sick');
    await user.click(within(dialog).getByRole('button', { name: copy.leave.declare }));

    await waitFor(() => {
      const call = findCall(fetchMock, 'POST', '/api/v1/users/7/leave-requests');
      expect(JSON.parse(call?.[1].body as string)).toMatchObject({
        dayTypeCode: 'sick',
        startDate: '2026-11-03',
        startHalf: 'am',
        endHalf: 'am',
      });
    });
    expect(await within(dialog).findByText(copy.leave.declared)).toBeInTheDocument();
  });

  it('declares from the top bar button, starting today', async () => {
    const { user } = renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: LEA_CALENDAR },
    });

    await user.click(
      await screen.findByRole('button', { name: `${copy.calendar.declareFor} Léa` }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Déclarer une absence pour Léa Moreau' }),
    ).toBeInTheDocument();
  });

  it('asks before cancelling a declared half-day as a manager', async () => {
    const { user, fetchMock } = renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: LEA_CALENDAR },
      'PUT /api/v1/leave-requests/4/cancellation': { status: 200, body: { id: 4 } },
    });

    await user.click(await screen.findByRole('button', { name: /^23 nov\. : Congé · matin/ }));
    expect(screen.getByText('Annuler la demande de Congé qui couvre le 23 nov. ?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmCancel }));

    await waitFor(() =>
      expect(findCall(fetchMock, 'PUT', '/api/v1/leave-requests/4/cancellation')).toBeDefined(),
    );
  });

  it('keeps the request when the manager changes their mind', async () => {
    const { user, fetchMock } = renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: LEA_CALENDAR },
    });

    await user.click(await screen.findByRole('button', { name: /^23 nov\. : Congé · matin/ }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.keep }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(findCall(fetchMock, 'PUT', '/api/v1/leave-requests/4/cancellation')).toBeUndefined();
  });

  it('shows the server refusal when the cancellation fails', async () => {
    const { user } = renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: LEA_CALENDAR },
      'PUT /api/v1/leave-requests/4/cancellation': {
        status: 409,
        body: {
          code: 'LEAVE_NOT_CANCELLABLE',
          message: 'Cette demande ne peut plus être annulée.',
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: /^23 nov\. : Congé · matin/ }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmCancel }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette demande ne peut plus être annulée.',
    );
  });

  it("offers no action on a colleague's calendar", async () => {
    renderAs(SIGNED_IN_SESSION, '/calendrier/9?periode=2026', {
      'GET /api/v1/users/9/year-calendars/2026': {
        status: 200,
        body: yearCalendar({ user: { id: 9, firstName: 'Hugo', lastName: 'Laurent' } }),
      },
    });

    await screen.findByRole('heading', { name: 'Calendrier de Hugo Laurent' });
    expect(screen.queryAllByRole('button', { name: /nov\. :/ })).toEqual([]);
  });

  it('opens the request dialog on a free future half of your own calendar', async () => {
    const { user } = renderAs(SIGNED_IN_SESSION, '/calendrier?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': { status: 200, body: yearCalendar() },
    });

    await user.click(await screen.findByRole('button', { name: /^2 déc\. : après-midi/ }));

    expect(screen.getByRole('dialog', { name: copy.leave.dialogTitle })).toBeInTheDocument();
  });

  it('does not let you request a past half, a weekend, a holiday or a declared half', async () => {
    renderAs(SIGNED_IN_SESSION, '/calendrier?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': {
        status: 200,
        body: yearCalendar({
          holidays: [{ date: '2026-12-25', label: 'Noël' }],
          halfDays: [
            {
              date: '2026-11-23',
              half: 'am',
              dayTypeCode: 'leave',
              status: 'approved',
              leaveRequestId: 4,
            },
          ],
        }),
      },
    });

    await screen.findAllByRole('table');
    expect(screen.queryByRole('button', { name: /^3 nov\. : matin/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^14 nov\. :/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^25 déc\. : matin/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^23 nov\. : matin/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^13 nov\. : matin/ })).toBeInTheDocument();
  });

  it('keeps days outside the period out of reach', async () => {
    renderAs(MANAGER_SESSION, '/calendrier/7?periode=2026', {
      'GET /api/v1/users/7/year-calendars/2026': {
        status: 200,
        body: yearCalendar({
          canDeclare: true,
          period: { startDate: '2026-07-15', endDate: '2027-06-30' },
        }),
      },
    });

    await screen.findAllByRole('table');
    expect(screen.queryByRole('button', { name: /^10 juil\. :/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^16 juil\. : matin/ })).toBeInTheDocument();
  });
});
