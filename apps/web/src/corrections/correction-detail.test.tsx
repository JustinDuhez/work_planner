import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClockCorrectionView } from '@work-planner/domain';
import { copy } from '../copy';
import { HUGO, LEA, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes, type MockResponse } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

const ISO_WEEK = '2026-W45';
const CORRECTION: ClockCorrectionView = {
  id: 11,
  user: LEA,
  author: { id: 2, firstName: 'Sophie', lastName: 'Dubois' },
  workDate: '2026-11-03',
  status: 'pending',
  comment: 'Réunion client oubliée',
  responseComment: null,
  createdAt: '2026-11-04T09:00:00.000Z',
  respondedAt: null,
  before: {
    workMode: 'telework',
    periods: [{ startedAt: '2026-11-03T08:00:00.000Z', endedAt: '2026-11-03T16:00:00.000Z' }],
    workedMinutes: 480,
  },
  after: {
    workMode: 'on_site',
    periods: [{ startedAt: '2026-11-03T08:00:00.000Z', endedAt: '2026-11-03T16:30:00.000Z' }],
    workedMinutes: 510,
  },
  differenceMinutes: 30,
  canAnswer: true,
};
const CORRECTION_URL = `/api/v1/clock-corrections/${CORRECTION.id}`;
const REFUSED_LIST_URL = `GET /api/v1/users/${LEA.id}/clock-corrections?statut=refused`;
const DETAIL_LINK = `/?semaine=${ISO_WEEK}&correction=${CORRECTION.id}`;

function renderLeaWeek(path: string, extra: Record<string, MockResponse> = {}, counters = {}) {
  const week = weekFixture({
    isoWeek: ISO_WEEK,
    days: { '2026-11-03': { latestCorrection: { id: CORRECTION.id, status: 'pending' } } },
    counters,
  });
  const fetchMock = mockFetchRoutes({
    ...signedInHomeRoutes(week),
    [`GET ${CORRECTION_URL}`]: { status: 200, body: CORRECTION },
    ...extra,
  });
  const rendered = renderApp(path);
  return { ...rendered, fetchMock, user: userEvent.setup() };
}

function patchBody(fetchMock: ReturnType<typeof mockFetchRoutes>): unknown {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => url === CORRECTION_URL && (init as RequestInit).method === 'PATCH',
  ) as [string, RequestInit];
  return JSON.parse(call[1].body as string);
}

// The dialog opens at once; its content arrives with the correction.
async function findLoadedDetail() {
  const dialog = await screen.findByRole('dialog', { name: copy.corrections.detailTitle });
  await within(dialog).findByText(copy.corrections.beforeTitle);
  return dialog;
}

const PATCH_ACCEPTED = {
  [`PATCH ${CORRECTION_URL}`]: {
    status: 200,
    body: { ...CORRECTION, status: 'accepted', canAnswer: false },
  },
};
const PATCH_REFUSED = {
  [`PATCH ${CORRECTION_URL}`]: {
    status: 200,
    body: { ...CORRECTION, status: 'refused', canAnswer: false },
  },
};

describe('correction detail', () => {
  it('opens from the ?correction= link and compares before and after', async () => {
    renderLeaWeek(DETAIL_LINK);

    const dialog = await findLoadedDetail();

    expect(within(dialog).getByText('09:00 – 17:00')).toBeInTheDocument();
    expect(within(dialog).getByText('09:00 – 17:30')).toBeInTheDocument();
    expect(within(dialog).getByText('+0:30')).toBeInTheDocument();
    expect(within(dialog).getByText('Réunion client oubliée')).toBeInTheDocument();
  });

  it('opens from the status chip of the day', async () => {
    const { user, router } = renderLeaWeek(`/?semaine=${ISO_WEEK}`);

    await user.click(await screen.findByRole('button', { name: copy.corrections.statusPending }));

    expect(
      await screen.findByRole('dialog', { name: copy.corrections.detailTitle }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?semaine=${ISO_WEEK}&correction=${CORRECTION.id}`);
  });

  it('accepts the correction', async () => {
    const { user, fetchMock } = renderLeaWeek(DETAIL_LINK, PATCH_ACCEPTED);
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.accept }));

    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ status: 'accepted' }));
  });

  it('refuses it with a comment', async () => {
    const { user, fetchMock } = renderLeaWeek(DETAIL_LINK, PATCH_REFUSED);
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.refuse }));
    await user.type(
      within(dialog).getByLabelText(copy.corrections.refusalComment),
      "J'étais en déplacement.",
    );
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.confirmRefusal }));

    await waitFor(() =>
      expect(patchBody(fetchMock)).toEqual({
        status: 'refused',
        responseComment: "J'étais en déplacement.",
      }),
    );
  });

  it('refuses it without a comment when none is typed', async () => {
    const { user, fetchMock } = renderLeaWeek(DETAIL_LINK, PATCH_REFUSED);
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.refuse }));
    await user.click(within(dialog).getByRole('button', { name: copy.corrections.confirmRefusal }));

    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ status: 'refused' }));
  });

  it('closes the dialog and drops the link once the answer is saved', async () => {
    const { user, router } = renderLeaWeek(DETAIL_LINK, PATCH_ACCEPTED);
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.accept }));

    await waitFor(() => expect(router.state.location.search).toBe(`?semaine=${ISO_WEEK}`));
    expect(
      screen.queryByRole('dialog', { name: copy.corrections.detailTitle }),
    ).not.toBeInTheDocument();
  });

  it('shows the error and stays open when the answer fails', async () => {
    const { user, router } = renderLeaWeek(DETAIL_LINK, {
      [`PATCH ${CORRECTION_URL}`]: {
        status: 409,
        body: { code: 'CONFLICT', message: 'Déjà traitée.' },
      },
    });
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.accept }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Déjà traitée.');
    expect(router.state.location.search).toContain('correction=');
  });

  it('shows no answer buttons when the viewer cannot answer', async () => {
    renderLeaWeek(DETAIL_LINK, {
      [`GET ${CORRECTION_URL}`]: {
        status: 200,
        body: { ...CORRECTION, canAnswer: false, status: 'accepted' },
      },
    });
    const dialog = await findLoadedDetail();

    expect(
      within(dialog).queryByRole('button', { name: copy.corrections.accept }),
    ).not.toBeInTheDocument();
  });

  it('shows the answer, an empty day and a running period', async () => {
    renderLeaWeek(DETAIL_LINK, {
      [`GET ${CORRECTION_URL}`]: {
        status: 200,
        body: {
          ...CORRECTION,
          canAnswer: false,
          comment: null,
          responseComment: 'Non.',
          before: { workMode: null, periods: [], workedMinutes: 0 },
          after: {
            ...CORRECTION.after,
            periods: [{ startedAt: '2026-11-03T08:00:00.000Z', endedAt: null }],
          },
        },
      },
    });
    const dialog = await findLoadedDetail();

    expect(within(dialog).getByText(copy.corrections.noPeriod)).toBeInTheDocument();
    expect(within(dialog).getByText('09:00 – …')).toBeInTheDocument();
    expect(
      within(dialog).getByText(`${copy.corrections.responseCommentLabel} : Non.`),
    ).toBeInTheDocument();
  });

  it('says when the correction cannot be loaded', async () => {
    renderLeaWeek(DETAIL_LINK, {
      [`GET ${CORRECTION_URL}`]: {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'Introuvable.' },
      },
    });

    expect(await screen.findByText(copy.corrections.loadError)).toBeInTheDocument();
  });

  it.each(['abc', '0', '-2', '1.5'])('ignores the invalid link ?correction=%s', async (value) => {
    renderLeaWeek(`/?semaine=${ISO_WEEK}&correction=${value}`);

    expect(await screen.findByText(copy.counters.globalTitle)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes ?correction= from the URL when closed, keeping the week', async () => {
    const { user, router } = renderLeaWeek(DETAIL_LINK);
    const dialog = await findLoadedDetail();

    await user.click(within(dialog).getByRole('button', { name: copy.corrections.close }));

    expect(router.state.location.search).toBe(`?semaine=${ISO_WEEK}`);
  });

  it('turns the balance red and lists the refused corrections', async () => {
    const { user } = renderLeaWeek(
      `/?semaine=${ISO_WEEK}`,
      {
        [REFUSED_LIST_URL]: {
          status: 200,
          body: [{ ...CORRECTION, status: 'refused', responseComment: 'Non.' }],
        },
      },
      { hasOpenRefusal: true, globalGapMinutes: -30 },
    );

    expect(await screen.findByText('−0:30')).toHaveClass('text-rose-700');
    await user.click(screen.getByRole('button', { name: copy.corrections.refusedLink }));
    const list = screen.getByRole('dialog', { name: copy.corrections.refusedTitle });

    expect(await within(list).findByText(/Non\./)).toBeInTheDocument();
  });

  it('opens a refused correction from the list', async () => {
    const { user, router } = renderLeaWeek(
      `/?semaine=${ISO_WEEK}`,
      { [REFUSED_LIST_URL]: { status: 200, body: [{ ...CORRECTION, status: 'refused' }] } },
      { hasOpenRefusal: true },
    );

    await user.click(await screen.findByRole('button', { name: copy.corrections.refusedLink }));
    const list = screen.getByRole('dialog', { name: copy.corrections.refusedTitle });
    await user.click(await within(list).findByRole('button', { name: /3 nov/ }));

    expect(router.state.location.search).toBe(`?semaine=${ISO_WEEK}&correction=${CORRECTION.id}`);
    expect(
      await screen.findByRole('dialog', { name: copy.corrections.detailTitle }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: copy.corrections.refusedTitle }),
    ).not.toBeInTheDocument();
  });

  it('says when no correction was refused, then closes the list', async () => {
    const { user } = renderLeaWeek(
      `/?semaine=${ISO_WEEK}`,
      { [REFUSED_LIST_URL]: { status: 200, body: [] } },
      { hasOpenRefusal: true },
    );

    await user.click(await screen.findByRole('button', { name: copy.corrections.refusedLink }));
    const list = screen.getByRole('dialog', { name: copy.corrections.refusedTitle });
    expect(await within(list).findByText(copy.corrections.refusedEmpty)).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: copy.corrections.close }));

    expect(
      screen.queryByRole('dialog', { name: copy.corrections.refusedTitle }),
    ).not.toBeInTheDocument();
  });

  it('shows an error when the refused list cannot be loaded', async () => {
    const { user } = renderLeaWeek(
      `/?semaine=${ISO_WEEK}`,
      { [REFUSED_LIST_URL]: { status: 500, body: { code: 'INTERNAL', message: 'Oups.' } } },
      { hasOpenRefusal: true },
    );

    await user.click(await screen.findByRole('button', { name: copy.corrections.refusedLink }));
    const list = screen.getByRole('dialog', { name: copy.corrections.refusedTitle });

    expect(await within(list).findByRole('alert')).toHaveTextContent(copy.corrections.loadError);
  });

  it("hides the refused list link from someone who cannot see the person's corrections", async () => {
    const week = weekFixture({
      isoWeek: ISO_WEEK,
      user: HUGO,
      isOwnWeek: false,
      counters: { hasOpenRefusal: true, canViewCorrections: false },
    });
    mockFetchRoutes({
      ...signedInHomeRoutes(),
      [`GET /api/v1/users/${HUGO.id}/clock-weeks/${ISO_WEEK}`]: { status: 200, body: week },
    });
    renderApp(`/pointage/${HUGO.id}?semaine=${ISO_WEEK}`);

    expect(await screen.findByText(copy.counters.globalTitle)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.corrections.refusedLink }),
    ).not.toBeInTheDocument();
  });
});
