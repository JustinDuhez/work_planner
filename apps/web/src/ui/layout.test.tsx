import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expectNoAxeViolations } from '../test/axe';
import { Avatar, initialsOf } from './avatar';
import { PageLayout } from './page-layout';
import { SegmentedTabs } from './segmented-tabs';
import { Stat } from './stat';
import { SummaryCard } from './summary-card';

describe('PageLayout', () => {
  it('keeps the main content before the summary card for screen readers', async () => {
    const { container } = render(
      <PageLayout
        bar={<h1>Calendrier</h1>}
        main={<p>Les mois</p>}
        aside={
          <SummaryCard title="Mon année">
            <Stat label="Absences" value="14,5" unit="j" />
          </SummaryCard>
        }
      />,
    );

    const main = screen.getByText('Les mois');
    const aside = screen.getByRole('region', { name: 'Mon année' });
    expect(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('renders without a side card', () => {
    const { container } = render(<PageLayout bar={<h1>Profil</h1>} main={<p>Formulaire</p>} />);

    expect(container.querySelector('[data-slot="aside"]')).toBeNull();
  });
});

describe('Stat and Avatar', () => {
  it('shows a label, a big value, its unit and a hint', () => {
    render(<Stat label="Congé" value="9" unit="j" hint="+2 j en attente" />);

    expect(screen.getByText('Congé')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('+2 j en attente')).toBeInTheDocument();
  });

  it('turns a name into initials and hides them from screen readers', () => {
    expect(initialsOf('Léa', 'Moreau')).toBe('LM');
    expect(initialsOf('émile', 'durand')).toBe('ÉD');
    const { container } = render(<Avatar firstName="Léa" lastName="Moreau" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

function TabsHarness() {
  const [selected, setSelected] = useState('mine');
  return (
    <SegmentedTabs
      label="Demandes"
      tabs={[
        { id: 'mine', label: 'Mes demandes', panelId: 'p-mine' },
        { id: 'review', label: 'À valider · 3', panelId: 'p-review' },
      ]}
      selectedId={selected}
      onSelect={setSelected}
    />
  );
}

describe('SegmentedTabs', () => {
  it('moves between tabs with the arrow keys, one tab stop', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const mine = screen.getByRole('tab', { name: 'Mes demandes' });
    const review = screen.getByRole('tab', { name: 'À valider · 3' });

    expect(mine).toHaveAttribute('tabindex', '0');
    expect(review).toHaveAttribute('tabindex', '-1');
    mine.focus();
    await user.keyboard('{ArrowRight}');

    expect(review).toHaveFocus();
    expect(review).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(mine).toHaveFocus();
  });
});
