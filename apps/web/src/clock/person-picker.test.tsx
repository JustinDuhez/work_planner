import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { copy } from '../copy';
import { signedInHomeRoutes, weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

const WEEK = '2026-W45';

describe('PersonPicker', () => {
  beforeEach(() => {
    mockFetchRoutes(signedInHomeRoutes(weekFixture({ isoWeek: WEEK })));
  });

  it('lists me first and links to my own week', async () => {
    renderApp(`/?semaine=${WEEK}`);

    const links = await screen.findAllByRole('link', { name: /Moreau|Laurent/ });

    expect(links[0]).toHaveTextContent(`Léa Moreau ${copy.clock.you}`);
    expect(links[0]).toHaveAttribute('href', `/?semaine=${WEEK}`);
    expect(links[1]).toHaveAttribute('href', `/pointage/9?semaine=${WEEK}`);
  });

  it('says so when nobody matches the search', async () => {
    renderApp(`/?semaine=${WEEK}`);

    await userEvent.setup().type(await screen.findByLabelText(copy.clock.searchPerson), 'zzz');

    expect(screen.getByText(copy.clock.noPersonFound)).toBeInTheDocument();
  });
});
