import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toWorkDate } from '@work-planner/domain';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { copy } from '../copy';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { DAY_TYPES, leaveRequestView } from '../test/leave-fixtures';
import { expectNoAxeViolations } from '../test/axe';
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

function renderPage(path: string, extra: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/day-types': { status: 200, body: DAY_TYPES },
    'GET /api/v1/leave-requests?view=mine': { status: 200, body: [] },
    ...extra,
  });
  const rendered = renderApp(path);
  return { ...rendered, fetchMock, user: userEvent.setup() };
}

function findCall(fetchMock: jest.Mock, method: string, url: string) {
  return fetchMock.mock.calls.find(
    ([callUrl, init]) => callUrl === url && (init as RequestInit | undefined)?.method === method,
  ) as [string, RequestInit] | undefined;
}

describe('LeaveRequestsPage', () => {
  it('lists my requests with their status and period', async () => {
    renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': {
        status: 200,
        body: [
          leaveRequestView({ id: 1 }),
          leaveRequestView({
            id: 2,
            status: 'refused',
            reviewer: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
            reviewComment: 'Période chargée',
            canCancel: false,
          }),
        ],
      },
    });

    const cards = await within(await screen.findByRole('tabpanel')).findAllByRole('listitem');

    expect(
      within(cards[0] as HTMLElement).getByText(copy.leaveRequests.status.pending),
    ).toBeInTheDocument();
    expect(
      within(cards[0] as HTMLElement).getByText('3 jours · du 23 nov. 2026 au 25 nov. 2026'),
    ).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText('Période chargée')).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText('Congé')).toBeInTheDocument();
    expect(
      within(cards[1] as HTMLElement).queryByRole('button', { name: copy.leaveRequests.cancel }),
    ).not.toBeInTheDocument();
  });

  it('asks before cancelling, then cancels', async () => {
    const { user, fetchMock } = renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': { status: 200, body: [leaveRequestView({ id: 4 })] },
      'PUT /api/v1/leave-requests/4/cancellation': {
        status: 200,
        body: leaveRequestView({ id: 4, status: 'cancelled', canCancel: false }),
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.cancel }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmCancel }));

    await waitFor(() =>
      expect(findCall(fetchMock, 'PUT', '/api/v1/leave-requests/4/cancellation')).toBeDefined(),
    );
  });

  it('reloads the lists when a cancellation is refused by the server', async () => {
    const { user, fetchMock } = renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': { status: 200, body: [leaveRequestView({ id: 4 })] },
      'PUT /api/v1/leave-requests/4/cancellation': {
        status: 409,
        body: {
          code: 'LEAVE_NOT_CANCELLABLE',
          message: 'Cette demande ne peut plus être annulée.',
        },
      },
    });
    const mineLoads = () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/v1/leave-requests?view=mine').length;

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.cancel }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmCancel }));

    await waitFor(() => expect(mineLoads()).toBe(2));
  });

  it('hides the inbox tab from a collaborator', async () => {
    renderPage('/demandes');

    expect(
      await screen.findByRole('tab', { name: copy.leaveRequests.mineTab }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: new RegExp(copy.leaveRequests.toReviewTab) }),
    ).not.toBeInTheDocument();
  });

  it('says who declared a request', async () => {
    const declared = leaveRequestView({
      status: 'approved',
      declaredBy: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
    });
    renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': { status: 200, body: [declared] },
    });

    expect(await screen.findByText('Déclarée par Sophie Dubois')).toBeInTheDocument();
  });

  it('lets a manager cancel a pending request of their team, after asking', async () => {
    const pending = leaveRequestView({ id: 5, canReview: true, canCancel: true });
    const { user, fetchMock } = renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [pending], recent: [] },
      },
      'PUT /api/v1/leave-requests/5/cancellation': { status: 200, body: pending },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.cancel }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmCancel }));

    await waitFor(() =>
      expect(findCall(fetchMock, 'PUT', '/api/v1/leave-requests/5/cancellation')).toBeDefined(),
    );
  });

  it('lets a direct manager approve a request', async () => {
    const pending = leaveRequestView({ id: 5, canReview: true, canCancel: false });
    const { user, fetchMock } = renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [pending], recent: [] },
      },
      'PUT /api/v1/leave-requests/5/review': {
        status: 200,
        body: { ...pending, status: 'approved', canReview: false },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.approve }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmApprove }));

    await waitFor(() => {
      const call = findCall(fetchMock, 'PUT', '/api/v1/leave-requests/5/review');
      expect(JSON.parse(call?.[1].body as string)).toEqual({ decision: 'approved' });
    });
  });

  it('needs a comment to refuse', async () => {
    const pending = leaveRequestView({ id: 6, canReview: true, canCancel: false });
    const { user, fetchMock } = renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [pending], recent: [] },
      },
      'PUT /api/v1/leave-requests/6/review': {
        status: 200,
        body: { ...pending, status: 'refused', canReview: false },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.refuse }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmRefuse }));
    expect(screen.getByText(copy.leaveRequests.commentRequired)).toBeInTheDocument();
    await user.type(screen.getByLabelText(copy.leaveRequests.comment), 'Période chargée');
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmRefuse }));

    await waitFor(() => {
      const call = findCall(fetchMock, 'PUT', '/api/v1/leave-requests/6/review');
      expect(JSON.parse(call?.[1].body as string)).toEqual({
        decision: 'refused',
        comment: 'Période chargée',
      });
    });
  });

  it('shows a higher-level manager the request without decision buttons', async () => {
    renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: {
          pending: [leaveRequestView({ id: 7, canReview: false, canCancel: false })],
          recent: [],
        },
      },
    });

    expect(await screen.findByText(copy.leaveRequests.decidedByDirectManager)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.leaveRequests.approve }),
    ).not.toBeInTheDocument();
  });

  it('shows the rule note held telework carries', async () => {
    const note = 'Il ne resterait que 2,5 jours sur site la semaine du 23 nov.';
    renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: {
          pending: [
            leaveRequestView({ id: 8, dayTypeCode: 'telework', ruleNote: note, canReview: true }),
          ],
          recent: [],
        },
      },
    });

    expect(await screen.findByText(note)).toBeInTheDocument();
  });

  it('keeps a collaborator on their own requests whatever the tab in the address', async () => {
    const { fetchMock } = renderPage('/demandes?onglet=a-valider');

    expect(await screen.findByText(copy.leaveRequests.noRequests)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: copy.leaveRequests.mineTab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('view=to-review'))).toBe(
      false,
    );
  });

  it('forgets the refusal comment when the manager steps back', async () => {
    const pending = leaveRequestView({ id: 9, canReview: true, canCancel: false });
    const { user, fetchMock } = renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [pending], recent: [] },
      },
      'PUT /api/v1/leave-requests/9/review': {
        status: 200,
        body: { ...pending, status: 'approved', canReview: false },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.refuse }));
    await user.type(screen.getByLabelText(copy.leaveRequests.comment), 'Période chargée');
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.keep }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.approve }));
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmApprove }));

    await waitFor(() => {
      const call = findCall(fetchMock, 'PUT', '/api/v1/leave-requests/9/review');
      expect(JSON.parse(call?.[1].body as string)).toEqual({ decision: 'approved' });
    });
  });

  it('shows the server comment error under the comment field', async () => {
    const pending = leaveRequestView({ id: 10, canReview: true, canCancel: false });
    const { user } = renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [pending], recent: [] },
      },
      'PUT /api/v1/leave-requests/10/review': {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Certains champs sont invalides.',
          fieldErrors: { comment: 'Commentaire trop long.' },
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.leaveRequests.refuse }));
    await user.type(screen.getByLabelText(copy.leaveRequests.comment), 'x');
    await user.click(screen.getByRole('button', { name: copy.leaveRequests.confirmRefuse }));

    expect(await screen.findByText('Commentaire trop long.')).toBeInTheDocument();
  });

  it('lists recent decisions under the pending requests', async () => {
    renderPage('/demandes?onglet=a-valider', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: {
          pending: [],
          recent: [
            leaveRequestView({
              id: 11,
              status: 'refused',
              reviewer: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
              reviewComment: 'Période chargée',
              canCancel: false,
            }),
          ],
        },
      },
    });

    expect(await screen.findByText(copy.leaveRequests.recentTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.leaveRequests.noPending)).toBeInTheDocument();
    expect(screen.getByText('Période chargée')).toBeInTheDocument();
  });

  it('says when a request was approved automatically', async () => {
    renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': {
        status: 200,
        body: [leaveRequestView({ id: 12, status: 'approved', isAutoApproved: true })],
      },
    });

    expect(await screen.findByText(copy.leaveRequests.status.autoApproved)).toBeInTheDocument();
  });

  it('puts the chosen tab in the address', async () => {
    const { user, router } = renderPage('/demandes', {
      'GET /api/v1/me': { status: 200, body: MANAGER_SESSION },
      'GET /api/v1/leave-requests?view=to-review': {
        status: 200,
        body: { pending: [], recent: [] },
      },
    });

    await user.click(
      await screen.findByRole('tab', { name: new RegExp(copy.leaveRequests.toReviewTab) }),
    );
    expect(router.state.location.search).toBe('?onglet=a-valider');

    await user.click(screen.getByRole('tab', { name: copy.leaveRequests.mineTab }));
    expect(router.state.location.search).toBe('?onglet=mes-demandes');
  });

  it('has a Demandes link in the header', async () => {
    renderPage('/demandes');

    expect(await screen.findByRole('link', { name: copy.nav.leave })).toHaveAttribute(
      'href',
      '/demandes',
    );
  });

  it('shows one status chip per card, the type as the title and the rest as plain text', async () => {
    renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': {
        status: 200,
        body: [
          leaveRequestView({
            status: 'approved',
            declaredBy: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
          }),
        ],
      },
    });

    const card = (await within(await screen.findByRole('tabpanel')).findAllByRole('listitem'))[0]!;

    expect(card.querySelectorAll('.rounded-full')).toHaveLength(1);
    expect(within(card).getByText(copy.leaveRequests.status.approved)).toHaveClass('rounded-full');
    expect(within(card).getByText('Congé')).not.toHaveClass('rounded-full');
    expect(within(card).getByText('Déclarée par Sophie Dubois')).toBeInTheDocument();
  });

  it('offers the request button as the one primary action of the page', async () => {
    const { user } = renderPage('/demandes');

    const button = await screen.findByRole('button', { name: copy.leave.requestButton });
    await user.click(button);

    expect(button).toHaveClass('bg-primary-600');
    const dialog = screen.getByRole('dialog', { name: copy.leave.dialogTitle });
    const today = toWorkDate(new Date(), APP_TIME_ZONE);
    expect(within(dialog).getByLabelText(copy.leave.startDate)).toHaveAttribute('min', today);
  });

  it('announces the loading as one busy region', async () => {
    renderPage('/demandes');
    const answer = globalThis.fetch;
    globalThis.fetch = (input, init) =>
      typeof input === 'string' && input.includes('/leave-requests')
        ? new Promise<Response>(() => undefined)
        : answer(input, init);

    renderApp('/demandes');

    const label = await screen.findByText(copy.leaveRequests.loading);
    expect(label.closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('says so when the requests cannot be loaded and loads them again on demand', async () => {
    const url = '/api/v1/leave-requests?view=mine';
    const { queryClient, container, fetchMock } = renderPage('/demandes', {
      [`GET ${url}`]: { status: 500, body: {} },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.leaveRequests.loadError);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: copy.states.retry }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === url)).toHaveLength(2));
  });

  it('shows an empty state without accessibility violation', async () => {
    const { queryClient, container } = renderPage('/demandes');

    const message = await screen.findByText(copy.leaveRequests.noRequests);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(message.closest('div')).toHaveClass('border-dashed');
    await expectNoAxeViolations(container);
  });

  it('has no accessibility violation with requests listed', async () => {
    const { queryClient, container } = renderPage('/demandes', {
      'GET /api/v1/leave-requests?view=mine': { status: 200, body: [leaveRequestView()] },
    });

    await screen.findByText('Congé');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });
});
