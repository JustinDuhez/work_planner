import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotificationView } from '@work-planner/domain';
import { copy } from '../copy';
import { HUGO, LEA, signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

const RECEIVED: NotificationView = {
  id: 1,
  type: 'clock_correction_received',
  payload: {
    correctionId: 11,
    ownerId: LEA.id,
    workDate: '2026-11-03',
    actorName: 'Sophie Dubois',
  },
  readAt: null,
  createdAt: '2026-11-04T09:00:00.000Z',
};
const ANSWERED: NotificationView = {
  id: 2,
  type: 'clock_correction_answered',
  payload: {
    correctionId: 12,
    ownerId: HUGO.id,
    workDate: '2026-11-02',
    actorName: 'Hugo Laurent',
    status: 'refused',
  },
  readAt: '2026-11-05T09:00:00.000Z',
  createdAt: '2026-11-03T09:00:00.000Z',
};

function renderWithNotifications(unreadCount: number, extra: Record<string, MockResponse> = {}) {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/notifications': {
      status: 200,
      body: { unreadCount, notifications: [RECEIVED, ANSWERED] },
    },
    ...extra,
  });
  const rendered = renderApp('/');
  return { ...rendered, fetchMock, user: userEvent.setup() };
}

describe('NotificationBell', () => {
  it('shows the unread count on the bell', async () => {
    renderWithNotifications(3);

    expect(
      await screen.findByRole('button', { name: `${copy.notifications.bell} (3)` }),
    ).toBeInTheDocument();
  });

  it('caps a large unread count at 9+', async () => {
    renderWithNotifications(12);

    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('shows no badge when everything is read', async () => {
    renderWithNotifications(0);

    expect(
      await screen.findByRole('button', { name: copy.notifications.bell }),
    ).toBeInTheDocument();
  });

  it('lists the notifications as French sentences', async () => {
    const { user } = renderWithNotifications(1);

    await user.click(await screen.findByRole('button', { name: `${copy.notifications.bell} (1)` }));
    const list = screen.getByRole('list', { name: copy.notifications.title });

    expect(
      within(list).getByText('Sophie Dubois a corrigé votre journée du 3 nov. 2026'),
    ).toBeInTheDocument();
    expect(
      within(list).getByText('Hugo Laurent a refusé votre correction du 2 nov. 2026'),
    ).toBeInTheDocument();
  });

  it("opens the corrected day's week and marks the notification read", async () => {
    const { user, router, fetchMock } = renderWithNotifications(1, {
      [`PATCH /api/v1/notifications/${RECEIVED.id}`]: {
        status: 200,
        body: { ...RECEIVED, readAt: '2026-11-09T10:00:00.000Z' },
      },
    });

    await user.click(await screen.findByRole('button', { name: `${copy.notifications.bell} (1)` }));
    await user.click(screen.getByRole('link', { name: /a corrigé votre journée/ }));

    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?semaine=2026-W45&correction=11');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/notifications/${RECEIVED.id}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it("links an answer to the corrected person's week", async () => {
    const { user } = renderWithNotifications(0);

    await user.click(await screen.findByRole('button', { name: copy.notifications.bell }));

    expect(screen.getByRole('link', { name: /a refusé votre correction/ })).toHaveAttribute(
      'href',
      `/pointage/${HUGO.id}?semaine=2026-W45&correction=12`,
    );
  });

  it('marks everything read', async () => {
    const { user, fetchMock } = renderWithNotifications(1, {
      'PATCH /api/v1/notifications': { status: 204 },
    });

    await user.click(await screen.findByRole('button', { name: `${copy.notifications.bell} (1)` }));
    await user.click(screen.getByRole('button', { name: copy.notifications.markAllRead }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('says when there is nothing new', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/notifications': { status: 200, body: { unreadCount: 0, notifications: [] } },
    });
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: copy.notifications.bell }));

    expect(screen.getByText(copy.notifications.empty)).toBeInTheDocument();
  });
});
