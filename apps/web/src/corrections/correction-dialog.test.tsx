import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { HUGO, LEA, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

// A fixed past week: every day can be corrected whatever the real date.
const ISO_WEEK = '2026-W45';
const TUESDAY = '2026-11-03';
const CORRECTION_URL = '/api/v1/clock-corrections';
const WEEK_URL = `/api/v1/users/${HUGO.id}/clock-weeks/${ISO_WEEK}`;
const SAVED_CORRECTION = {
  id: 1,
  user: HUGO,
  author: LEA,
  workDate: TUESDAY,
  status: 'pending',
  comment: null,
  responseComment: null,
  createdAt: '2026-11-09T09:00:00.000Z',
  respondedAt: null,
  before: { workMode: 'telework', periods: [], workedMinutes: 180 },
  after: { workMode: 'on_site', periods: [], workedMinutes: 420 },
  differenceMinutes: 240,
  canAnswer: true,
};

function renderHugoWeek(extra: Record<string, MockResponse> = {}) {
  const week = weekFixture({
    isoWeek: ISO_WEEK,
    user: HUGO,
    isOwnWeek: false,
    days: {
      [TUESDAY]: {
        canCorrect: true,
        workMode: 'telework',
        workedMinutes: 180,
        isUnclosed: true,
        periods: [
          { id: 1, startedAt: '2026-11-03T08:00:00.000Z', endedAt: '2026-11-03T11:00:00.000Z' },
          { id: 2, startedAt: '2026-11-03T12:00:00.000Z', endedAt: null },
        ],
      },
    },
  });
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(),
    [`GET /api/v1/users/${HUGO.id}/clock-weeks/${ISO_WEEK}`]: { status: 200, body: week },
    ...extra,
  });
  renderApp(`/pointage/${HUGO.id}?semaine=${ISO_WEEK}`);
  return { fetchMock, user: userEvent.setup() };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  const tuesday = await screen.findByRole('listitem', { name: /^MAR 3/ });
  await user.click(within(tuesday).getByRole('button', { name: copy.corrections.correctDay }));
  return screen.getByRole('dialog', { name: copy.corrections.dialogTitle });
}

function sentBody(fetchMock: jest.Mock): unknown {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => url === CORRECTION_URL && (init as RequestInit).method === 'POST',
  ) as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

describe('CorrectionDialog', () => {
  it('starts from the day as it is, the open period waiting for its end', async () => {
    const { user } = renderHugoWeek();

    const dialog = await openDialog(user);

    expect(
      within(dialog)
        .getAllByLabelText(copy.corrections.startTime)
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(['09:00', '13:00']);
    expect(
      within(dialog)
        .getAllByLabelText(copy.corrections.endTime)
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(['12:00', '']);
    expect(within(dialog).getByRole('radio', { name: copy.clock.telework })).toBeChecked();
  });

  it('shows the new total and the difference while editing', async () => {
    const { user } = renderHugoWeek();
    const dialog = await openDialog(user);

    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[1] as HTMLElement,
      '17:00',
    );

    expect(
      within(dialog).getByText(
        `${copy.corrections.total} 7:00 · ${copy.corrections.before} 3:00 · +4:00`,
      ),
    ).toBeInTheDocument();
  });

  it('sends the whole day with the chosen work mode and the comment', async () => {
    const { user, fetchMock } = renderHugoWeek({
      [`POST ${CORRECTION_URL}`]: { status: 201, body: SAVED_CORRECTION },
    });
    const dialog = await openDialog(user);

    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[1] as HTMLElement,
      '17:00',
    );
    await user.click(within(dialog).getByRole('radio', { name: copy.clock.onSite }));
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.addPeriod }));
    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.startTime)[2] as HTMLElement,
      '18:00',
    );
    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[2] as HTMLElement,
      '19:00',
    );
    await user.type(
      within(dialog).getByLabelText(copy.corrections.comment),
      'Réunion client oubliée',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.save }));

    expect(sentBody(fetchMock)).toEqual({
      userId: HUGO.id,
      date: TUESDAY,
      workMode: 'on_site',
      periods: [
        { startedAt: '09:00', endedAt: '12:00' },
        { startedAt: '13:00', endedAt: '17:00' },
        { startedAt: '18:00', endedAt: '19:00' },
      ],
      comment: 'Réunion client oubliée',
    });
  });

  it('closes the dialog and reloads the week once the correction is saved', async () => {
    const { user, fetchMock } = renderHugoWeek({
      [`POST ${CORRECTION_URL}`]: { status: 201, body: SAVED_CORRECTION },
    });
    const dialog = await openDialog(user);
    const weekFetches = () => fetchMock.mock.calls.filter(([url]) => url === WEEK_URL).length;
    expect(weekFetches()).toBe(1);

    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[1] as HTMLElement,
      '17:00',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.save }));

    await waitFor(() => expect(weekFetches()).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the dialog without sending anything on cancel', async () => {
    const { user, fetchMock } = renderHugoWeek();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sentBody(fetchMock)).toBeUndefined();
  });

  it('removes a period', async () => {
    const { user, fetchMock } = renderHugoWeek({
      [`POST ${CORRECTION_URL}`]: { status: 201, body: SAVED_CORRECTION },
    });
    const dialog = await openDialog(user);

    await user.click(
      within(dialog).getAllByRole('button', {
        name: copy.corrections.removePeriod,
      })[1] as HTMLElement,
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.save }));

    expect(sentBody(fetchMock)).toMatchObject({
      periods: [{ startedAt: '09:00', endedAt: '12:00' }],
    });
  });

  it('shows a server error on the faulty period', async () => {
    const { user } = renderHugoWeek({
      [`POST ${CORRECTION_URL}`]: {
        status: 400,
        body: {
          code: 'CLOCK_PERIOD_OVERLAP',
          message: 'Cette période chevauche une autre période.',
          fieldErrors: { 'periods.1.startedAt': 'Cette période chevauche une autre période.' },
        },
      },
    });
    const dialog = await openDialog(user);

    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[1] as HTMLElement,
      '17:00',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.save }));

    const [, secondStart] = within(dialog).getAllByLabelText(copy.corrections.startTime);
    expect(
      await within(dialog).findByText('Cette période chevauche une autre période.'),
    ).toBeInTheDocument();
    expect(secondStart).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a refusal that concerns no field in a banner', async () => {
    const { user } = renderHugoWeek({
      [`POST ${CORRECTION_URL}`]: {
        status: 403,
        body: {
          code: 'CLOCK_CORRECTION_FORBIDDEN',
          message: 'Vous ne pouvez pas corriger cette journée.',
        },
      },
    });
    const dialog = await openDialog(user);

    await user.type(
      within(dialog).getAllByLabelText(copy.corrections.endTime)[1] as HTMLElement,
      '17:00',
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.save }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Vous ne pouvez pas corriger cette journée.',
    );
  });

  it("does not offer the manager the old quick close of someone else's day", async () => {
    renderHugoWeek();

    const tuesday = await screen.findByRole('listitem', { name: /^MAR 3/ });

    expect(
      within(tuesday).queryByRole('button', { name: copy.clock.closeDay }),
    ).not.toBeInTheDocument();
  });
});
