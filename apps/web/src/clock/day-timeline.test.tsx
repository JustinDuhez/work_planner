import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClockDayView } from '@work-planner/domain';
import { DayTimeline } from './day-timeline';

const DAY: ClockDayView = {
  date: '2026-11-06',
  workMode: null,
  periods: [{ id: 4, startedAt: '2026-11-06T08:00:00.000Z', endedAt: null }],
  workedMinutes: 0,
  isToday: false,
  isFuture: false,
  isUnclosed: true,
  canEdit: false,
  canClose: false,
};
const NOW = new Date('2026-11-06T10:00:00Z');
const BAND = { name: '09:00 – …' };

describe('DayTimeline', () => {
  it('pulses a running period of today and draws it up to now', () => {
    render(<DayTimeline day={{ ...DAY, isToday: true, isUnclosed: false }} now={NOW} />);

    const band = screen.getByRole('img', BAND);
    expect(band).toHaveClass('animate-pulse');
    expect(band).toHaveStyle({ left: '37.5%' });
    expect(Number.parseFloat(band.style.width)).toBeCloseTo((2 / 24) * 100);
  });

  it('draws an unclosed period of a past day dashed, up to the end of the day', () => {
    render(<DayTimeline day={DAY} now={NOW} />);

    const band = screen.getByRole('img', BAND);
    expect(band).toHaveClass('border-dashed');
    expect(band).not.toHaveClass('animate-pulse');
    expect(band).toHaveStyle({ left: '37.5%', width: '62.5%' });
  });

  it('turns the bands into buttons that report the selected period', async () => {
    const onSelectPeriod = jest.fn();
    render(<DayTimeline day={DAY} now={NOW} onSelectPeriod={onSelectPeriod} />);

    await userEvent.setup().click(screen.getByRole('button', BAND));

    expect(onSelectPeriod).toHaveBeenCalledWith(4);
  });

  it('shows the start and end times as visible text', () => {
    render(
      <DayTimeline
        day={{
          ...DAY,
          periods: [
            { id: 1, startedAt: '2026-11-06T08:00:00.000Z', endedAt: '2026-11-06T11:30:00.000Z' },
            { id: 2, startedAt: '2026-11-06T12:30:00.000Z', endedAt: null },
          ],
        }}
        now={NOW}
      />,
    );

    expect(screen.getByText('09:00 – 12:30 · 13:30 – …')).toBeVisible();
  });

  it('keeps the bands read-only without a selection handler', () => {
    render(<DayTimeline day={DAY} now={NOW} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
