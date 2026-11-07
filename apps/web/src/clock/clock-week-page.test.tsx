import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { HUGO, LEA, signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { shiftIsoWeek } from './clock-time';

const WEEK = '2026-W45';

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
    });
    mockFetchRoutes(signedInHomeRoutes(week));

    renderApp(`/?semaine=${WEEK}`);

    const monday = await screen.findByRole('listitem', { name: /^LUN 2/ });
    expect(within(monday).getByText('7:00')).toBeInTheDocument();
    expect(screen.getByText(copy.clock.weekTotal).parentElement).toHaveTextContent('13:30');
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

    await userEvent.setup().click(await screen.findByRole('button', { name: copy.clock.nextWeek }));

    expect(await screen.findByText('S46')).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?semaine=${next}`);
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

  it('says so when the week cannot be loaded', async () => {
    mockFetchRoutes({
      ...signedInHomeRoutes(weekFixture({ isoWeek: WEEK })),
      [`GET /api/v1/users/${LEA.id}/clock-weeks/${WEEK}`]: {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Oups' },
      },
    });

    renderApp(`/?semaine=${WEEK}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.clock.loadError);
  });
});
