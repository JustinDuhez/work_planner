import { render, screen } from '@testing-library/react';
import { copy } from '../copy';
import type { ClockDayView } from '@work-planner/domain';
import { DayRow, WorkModeIcon } from './day-row';

const SUNDAY: ClockDayView = {
  date: '2026-11-08',
  workMode: null,
  periods: [],
  workedMinutes: 0,
  badgeableMinutes: 0,
  isToday: false,
  isFuture: false,
  isUnclosed: false,
  canEdit: false,
  canClose: false,
};

describe('DayRow', () => {
  it('fades a weekend day', () => {
    render(<DayRow day={SUNDAY} index={6} now={new Date()} />);
    expect(screen.getByRole('listitem')).toHaveClass('opacity-60');
  });

  it('never fades today, even on a weekend', () => {
    render(<DayRow day={{ ...SUNDAY, isToday: true }} index={6} now={new Date()} />);
    expect(screen.getByRole('listitem')).not.toHaveClass('opacity-60');
  });
});

describe('WorkModeIcon', () => {
  it('shows the telework icon', () => {
    render(<WorkModeIcon workMode="telework" />);
    expect(screen.getByLabelText(copy.clock.telework)).toBeInTheDocument();
  });

  it('shows the on-site icon', () => {
    render(<WorkModeIcon workMode="on_site" />);
    expect(screen.getByLabelText(copy.clock.onSite)).toBeInTheDocument();
  });

  it('shows nothing before a work mode is set', () => {
    const { container } = render(<WorkModeIcon workMode={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
