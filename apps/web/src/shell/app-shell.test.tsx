import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoAxeViolations } from '../test/axe';
import { signedInHomeRoutes } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { renderApp } from '../test/render-app';

function renderHome() {
  mockFetchRoutes(signedInHomeRoutes());
  return renderApp('/');
}

describe('AppShell', () => {
  it('lets keyboard users skip to the content', async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole('main');

    await user.tab();
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('opens the phone menu, closes it with Escape and gives focus back', async () => {
    const user = userEvent.setup();
    renderHome();
    const menuButton = await screen.findByRole('button', { name: 'Menu' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByRole('navigation', { name: 'Menu' })).getByRole('link', {
        name: 'Calendrier',
      }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });

  it('closes the phone menu on an outside click', async () => {
    const user = userEvent.setup();
    renderHome();
    const menuButton = await screen.findByRole('button', { name: 'Menu' });
    await user.click(menuButton);

    await user.click(screen.getByRole('main'));

    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('closes the phone menu when a link is chosen', async () => {
    const user = userEvent.setup();
    const { router } = renderHome();
    await user.click(await screen.findByRole('button', { name: 'Menu' }));

    await user.click(
      within(screen.getByRole('navigation', { name: 'Menu' })).getByRole('link', {
        name: 'Planning',
      }),
    );

    expect(router.state.location.pathname).toBe('/planning');
    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
    // The chosen link leaves with the panel: screen reader users start on the new page.
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('has no detectable accessibility problems', async () => {
    const { container, queryClient } = renderHome();
    await screen.findByRole('main');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await expectNoAxeViolations(container);
  });
});
