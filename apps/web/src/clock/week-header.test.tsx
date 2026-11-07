import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';
import { currentIsoWeek } from './clock-time';

const WEEK = '2026-W45';

describe('WeekHeader', () => {
  beforeEach(() => {
    mockFetchRoutes(signedInHomeRoutes(weekFixture({ isoWeek: WEEK })));
  });

  it('goes to the previous week', async () => {
    const { router } = renderApp(`/?semaine=${WEEK}`);

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: copy.clock.previousWeek }));

    expect(router.state.location.search).toBe('?semaine=2026-W44');
  });

  it('comes back to the current week', async () => {
    const { router } = renderApp(`/?semaine=${WEEK}`);

    await userEvent.setup().click(await screen.findByRole('button', { name: copy.clock.today }));

    expect(router.state.location.search).toBe(`?semaine=${currentIsoWeek(new Date())}`);
  });
});
