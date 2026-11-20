import { screen } from '@testing-library/react';
import { copy } from '../copy';
import { expectNoAxeViolations } from '../test/axe';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

describe('NotFoundPage', () => {
  it('offers a way back to the home page', async () => {
    mockFetchRoutes(signedInHomeRoutes());
    renderApp('/nulle-part');

    expect(await screen.findByRole('heading', { name: copy.notFound.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.notFound.backHome })).toHaveAttribute('href', '/');
  });

  it('has no detectable accessibility problems', async () => {
    mockFetchRoutes(signedInHomeRoutes());
    const { container } = renderApp('/nulle-part');
    await screen.findByRole('heading', { name: copy.notFound.title });

    await expectNoAxeViolations(container);
  });
});
