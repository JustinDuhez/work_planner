import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { StrictMode, useState } from 'react';
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

  it('shows a busy retry button that keeps the focus and ignores clicks while retrying', async () => {
    const retry = jest.fn();
    render(<ErrorState message="Impossible de charger." onRetry={retry} isRetrying />);
    const button = screen.getByRole('button', { name: 'Réessayer' });

    button.focus();
    await userEvent.setup().click(button);

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    expect(retry).not.toHaveBeenCalled();
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

  it('gives focus back to its opener when the browser closes it (Escape)', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir' });

    await user.click(opener);
    const dialog = screen.getByRole<HTMLDialogElement>('dialog', {
      name: 'Modifier la période',
    });
    dialog.close();
    fireEvent(dialog, new Event('close'));

    expect(opener).toHaveFocus();
  });

  it('gives focus back to its opener under StrictMode, where effects run twice', async () => {
    const user = userEvent.setup();
    // A real browser moves focus into the modal and ignores focus() on the inert page behind it.
    const showModal = jest
      .spyOn(HTMLDialogElement.prototype, 'showModal')
      .mockImplementation(function showModalWithFocus(this: HTMLDialogElement) {
        this.open = true;
        this.querySelector('button')?.focus();
      });
    render(
      <StrictMode>
        <DialogHarness />
      </StrictMode>,
    );
    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    const focusOpener = opener.focus.bind(opener);
    opener.focus = () => {
      if (!document.querySelector('dialog[open]')) focusOpener();
    };

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(opener).toHaveFocus();
    showModal.mockRestore();
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { container } = render(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));

    await expectNoAxeViolations(container);
  });
});
