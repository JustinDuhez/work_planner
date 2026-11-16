import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { expectNoAxeViolations } from '../test/axe';
import { Dialog } from './dialog';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingRegion, Skeleton } from './skeleton';
import { StatusMessage } from './status-message';

describe('shared states', () => {
  it('announces loading once and hides the skeleton blocks', async () => {
    const { container } = render(
      <LoadingRegion label="Chargement de la semaine…">
        <Skeleton className="h-6 w-40" />
      </LoadingRegion>,
    );

    expect(screen.getByText('Chargement de la semaine…')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('offers to try again after an error', async () => {
    const retry = jest.fn();
    render(<ErrorState message="Impossible de charger la semaine." onRetry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger la semaine.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state with its next action', () => {
    render(
      <EmptyState
        icon={Inbox}
        message="Aucune demande."
        action={<button type="button">Nouvelle demande</button>}
      />,
    );

    expect(screen.getByText('Aucune demande.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle demande' })).toBeInTheDocument();
  });

  it('keeps the status region mounted so screen readers hear new messages', () => {
    const { rerender } = render(<StatusMessage message={null} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    rerender(<StatusMessage message="Enregistré." />);
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré.');
  });
});

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Ouvrir
      </button>
      {isOpen ? (
        <Dialog title="Modifier la période" onClose={() => setIsOpen(false)}>
          <button type="button" onClick={() => setIsOpen(false)}>
            Fermer
          </button>
        </Dialog>
      ) : null}
    </>
  );
}

describe('Dialog', () => {
  it('is named by its title and gives focus back to its opener when closed', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir' });

    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Modifier la période' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(opener).toHaveFocus();
  });
});
