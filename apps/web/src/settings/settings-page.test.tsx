import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { expectNoAxeViolations } from '../test/axe';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { SIGNED_IN_SESSION } from '../test/sessions';

const ADMIN_SESSION = {
  ...SIGNED_IN_SESSION,
  user: { ...SIGNED_IN_SESSION.user, roles: { isAdmin: true, isManager: false } },
};
const HOLIDAYS_2026 = [
  { date: '2026-11-01', label: 'Toussaint' },
  { date: '2026-11-11', label: 'Armistice 1918' },
];

function renderSettings(extra: Record<string, MockResponse> = {}, path = '/parametres?annee=2026') {
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    'GET /api/v1/me': { status: 200, body: ADMIN_SESSION },
    'GET /api/v1/public-holidays?year=2026': { status: 200, body: HOLIDAYS_2026 },
    'GET /api/v1/settings': { status: 200, body: { yearStart: '07-01' } },
    ...extra,
  });
  const rendered = renderApp(path);
  return { ...rendered, fetchMock, user: userEvent.setup() };
}

function findCall(
  fetchMock: jest.Mock,
  method: string,
  url: string,
): [string, RequestInit] | undefined {
  return fetchMock.mock.calls.find(
    ([callUrl, init]) =>
      callUrl === url && ((init as RequestInit | undefined)?.method ?? 'GET') === method,
  ) as [string, RequestInit] | undefined;
}

async function sentBody(fetchMock: jest.Mock, method: string, url: string): Promise<unknown> {
  let body: unknown;
  await waitFor(() => {
    const call = findCall(fetchMock, method, url);
    expect(call).toBeDefined();
    body = JSON.parse(call?.[1].body as string);
  });
  return body;
}

describe('SettingsPage', () => {
  it('has no detectable accessibility problems', async () => {
    const { container, queryClient } = renderSettings();
    await screen.findByText('Armistice 1918');
    await screen.findByRole('button', { name: copy.settings.editYearStart });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('has no accessibility problems when the holidays cannot be loaded', async () => {
    const { container, queryClient } = renderSettings({
      'GET /api/v1/public-holidays?year=2026': {
        status: 500,
        body: { code: 'INTERNAL', message: 'x' },
      },
    });
    await screen.findByRole('alert');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('has no accessibility problems when the year start cannot be loaded', async () => {
    const { container, queryClient } = renderSettings({
      'GET /api/v1/settings': { status: 500, body: { code: 'INTERNAL', message: 'x' } },
    });
    await screen.findByRole('alert');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    await expectNoAxeViolations(container);
  });

  it('shows the year start as a stat, with no form until edited', async () => {
    renderSettings();

    const card = await screen.findByRole('region', { name: copy.settings.yearStartTitle });
    expect(within(card).getByText('1 juillet')).toBeInTheDocument();
    expect(within(card).queryByLabelText(copy.settings.yearStartMonth)).not.toBeInTheDocument();
  });

  it('announces the loading and shows no year start card yet', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      'GET /api/v1/me': { status: 200, body: ADMIN_SESSION },
      'GET /api/v1/public-holidays?year=2026': { status: 200, body: HOLIDAYS_2026 },
    });
    const initialFetch = globalThis.fetch;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
      input === '/api/v1/settings'
        ? new Promise<Response>(() => undefined)
        : initialFetch(input, init),
    ) as typeof fetch;
    renderApp('/parametres?annee=2026');

    expect(await screen.findByText(copy.settings.loading)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: copy.settings.yearStartTitle })).toBeNull();
  });

  it('offers a retry when the holidays cannot be loaded', async () => {
    renderSettings({
      'GET /api/v1/public-holidays?year=2026': {
        status: 500,
        body: { code: 'INTERNAL', message: 'x' },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.settings.loadError);
    expect(screen.getByRole('button', { name: copy.states.retry })).toBeInTheDocument();
  });

  it('lists the holidays of the year in the URL', async () => {
    renderSettings();

    expect(await screen.findByText('Armistice 1918')).toBeInTheDocument();
    expect(screen.getByText('11 nov. 2026')).toBeInTheDocument();
  });

  it('moves to the previous year', async () => {
    const { user, router } = renderSettings({
      'GET /api/v1/public-holidays?year=2025': { status: 200, body: [] },
    });

    await user.click(await screen.findByRole('button', { name: copy.settings.previousYear }));

    expect(router.state.location.search).toBe('?annee=2025');
    expect(await screen.findByText(copy.settings.noHolidays)).toBeInTheDocument();
  });

  it('imports the French holidays and says how many were added', async () => {
    const { user } = renderSettings({
      'POST /api/v1/public-holiday-imports': { status: 201, body: { addedCount: 9 } },
    });

    const importButton = await screen.findByRole('button', {
      name: 'Importer les jours fériés français 2026',
    });
    // The live region is mounted before the outcome so that the outcome is announced.
    expect(
      within(importButton.parentElement as HTMLElement).getByRole('status'),
    ).toBeEmptyDOMElement();
    await user.click(importButton);

    expect(await screen.findByText('9 jours ajoutés.')).toBeInTheDocument();
  });

  it('forgets the import message when the year changes', async () => {
    const { user } = renderSettings({
      'POST /api/v1/public-holiday-imports': { status: 201, body: { addedCount: 9 } },
      'GET /api/v1/public-holidays?year=2027': { status: 200, body: [] },
    });
    await user.click(
      await screen.findByRole('button', { name: 'Importer les jours fériés français 2026' }),
    );
    await screen.findByText('9 jours ajoutés.');

    await user.click(screen.getByRole('button', { name: copy.settings.nextYear }));

    expect(await screen.findByText(copy.settings.noHolidays)).toBeInTheDocument();
    expect(screen.queryByText('9 jours ajoutés.')).not.toBeInTheDocument();
  });

  it('says when every holiday was already there', async () => {
    const { user } = renderSettings({
      'POST /api/v1/public-holiday-imports': { status: 201, body: { addedCount: 0 } },
    });

    await user.click(
      await screen.findByRole('button', { name: 'Importer les jours fériés français 2026' }),
    );

    expect(
      await screen.findByText('Tous les jours fériés de 2026 sont déjà présents.'),
    ).toBeInTheDocument();
  });

  it('adds a holiday', async () => {
    const { user, fetchMock } = renderSettings({
      'POST /api/v1/public-holidays': {
        status: 201,
        body: { date: '2026-12-24', label: 'Pont de Noël' },
      },
    });

    await user.type(await screen.findByLabelText(copy.settings.holidayDate), '2026-12-24');
    await user.type(screen.getByLabelText(copy.settings.holidayLabel), 'Pont de Noël');
    await user.click(screen.getByRole('button', { name: copy.settings.addHoliday }));

    expect(await sentBody(fetchMock, 'POST', '/api/v1/public-holidays')).toEqual({
      date: '2026-12-24',
      label: 'Pont de Noël',
    });
  });

  it('asks before deleting a holiday', async () => {
    const { user, fetchMock } = renderSettings({
      'DELETE /api/v1/public-holidays/2026-11-11': { status: 204 },
    });
    const row = await screen.findByRole('listitem', { name: /Armistice 1918/ });

    await user.click(within(row).getByRole('button', { name: copy.settings.deleteHoliday }));
    expect(findCall(fetchMock, 'DELETE', '/api/v1/public-holidays/2026-11-11')).toBeUndefined();
    await user.click(within(row).getByRole('button', { name: copy.settings.confirmDelete }));

    await waitFor(() =>
      expect(findCall(fetchMock, 'DELETE', '/api/v1/public-holidays/2026-11-11')).toBeDefined(),
    );
  });

  it('keeps the holiday and sends nothing when the deletion is cancelled', async () => {
    const { user, fetchMock } = renderSettings();
    const row = await screen.findByRole('listitem', { name: /Armistice 1918/ });

    await user.click(within(row).getByRole('button', { name: copy.settings.deleteHoliday }));
    await user.click(within(row).getByRole('button', { name: copy.settings.cancel }));

    expect(
      within(row).queryByRole('button', { name: copy.settings.confirmDelete }),
    ).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: copy.settings.deleteHoliday })).toBeVisible();
    expect(findCall(fetchMock, 'DELETE', '/api/v1/public-holidays/2026-11-11')).toBeUndefined();
  });

  it('saves the year start', async () => {
    const { user, fetchMock } = renderSettings({
      'PATCH /api/v1/settings': { status: 200, body: { yearStart: '09-01' } },
    });

    await user.click(await screen.findByRole('button', { name: copy.settings.editYearStart }));
    await user.selectOptions(screen.getByLabelText(copy.settings.yearStartMonth), '09');
    const saveButton = screen.getByRole('button', { name: copy.settings.saveYearStart });
    expect(
      within(saveButton.parentElement as HTMLElement).getByRole('status'),
    ).toBeEmptyDOMElement();
    await user.click(saveButton);

    expect(await sentBody(fetchMock, 'PATCH', '/api/v1/settings')).toEqual({ yearStart: '09-01' });
    expect(await screen.findByText(copy.settings.saved)).toBeInTheDocument();
    expect(screen.getByText('1 septembre')).toBeInTheDocument();
  });

  it('shows the not-found page to a non-admin and no menu link', async () => {
    mockFetchRoutes(signedInHomeRoutes());
    renderApp('/parametres?annee=2026');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: copy.notFound.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.userMenu.open }));
    expect(screen.queryByRole('link', { name: copy.userMenu.settings })).not.toBeInTheDocument();
  });

  it('offers admins a Paramètres link in the user menu', async () => {
    const { user } = renderSettings();

    await user.click(await screen.findByRole('button', { name: copy.userMenu.open }));

    expect(screen.getByRole('link', { name: copy.userMenu.settings })).toHaveAttribute(
      'href',
      '/parametres',
    );
  });

  it('cannot go before the first year', async () => {
    renderSettings(
      { 'GET /api/v1/public-holidays?year=2000': { status: 200, body: [] } },
      '/parametres?annee=2000',
    );

    expect(await screen.findByRole('button', { name: copy.settings.previousYear })).toBeDisabled();
  });

  it('shows the server message when the year start is refused', async () => {
    const { user } = renderSettings({
      'PATCH /api/v1/settings': {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Certains champs sont invalides.',
          fieldErrors: { yearStart: 'Choisissez un jour qui existe chaque année.' },
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: copy.settings.editYearStart }));
    await user.click(screen.getByRole('button', { name: copy.settings.saveYearStart }));

    expect(
      await screen.findByText('Choisissez un jour qui existe chaque année.'),
    ).toBeInTheDocument();
  });

  it('shows the server message when the holiday already exists', async () => {
    const { user } = renderSettings({
      'POST /api/v1/public-holidays': {
        status: 409,
        body: { code: 'HOLIDAY_EXISTS', message: 'Ce jour est déjà férié.' },
      },
    });

    await user.type(await screen.findByLabelText(copy.settings.holidayDate), '2026-11-11');
    await user.type(screen.getByLabelText(copy.settings.holidayLabel), 'Armistice');
    await user.click(screen.getByRole('button', { name: copy.settings.addHoliday }));

    expect(await screen.findByText('Ce jour est déjà férié.')).toBeInTheDocument();
  });
});
