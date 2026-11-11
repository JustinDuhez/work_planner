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
  holidayLabel: null,
  isToday: false,
  isFuture: false,
  isUnclosed: false,
  canEdit: false,
  canClose: false,
  canCorrect: false,
  latestCorrection: null,
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

  it("shows the day's badgeable time next to its total", () => {
    const day = { ...SUNDAY, workedMinutes: 450, badgeableMinutes: 420 };

    render(
      <ol>
        <DayRow day={day} index={0} now={new Date()} />
      </ol>,
    );

    expect(screen.getByText('7:30')).toBeInTheDocument();
    expect(screen.getByText('/ 7:00')).toBeInTheDocument();
  });

  it('shows a public holiday badge, fades the row and shows no expected time', () => {
    const holiday: ClockDayView = { ...SUNDAY, date: '2026-11-11', holidayLabel: 'Armistice 1918' };

    render(<DayRow day={holiday} index={2} now={new Date()} />);

    expect(screen.getByText('Férié · Armistice 1918')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveClass('opacity-60');
    expect(screen.queryByText(/^\/ /)).not.toBeInTheDocument();
  });

  it('shows the total alone on a day without badgeable time', () => {
    const day = { ...SUNDAY, workedMinutes: 60, badgeableMinutes: 0 };

    render(
      <ol>
        <DayRow day={day} index={5} now={new Date()} />
      </ol>,
    );

    expect(screen.queryByText(/^\//)).not.toBeInTheDocument();
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
