import { render, screen, within } from '@testing-library/react';
import type { WeekCounters } from '@work-planner/domain';
import { copy } from '../copy';
import { weekFixture } from '../test/clock-fixtures';
import { CountersCard } from './counters-card';

const SERVER_NOW = '2026-11-06T14:30:00.000Z';

// weekFixture builds the current week, so "today" is always part of it.
function renderCard(counters: Partial<WeekCounters>, now = new Date(SERVER_NOW)) {
  const week = { ...weekFixture({ counters }), serverNow: SERVER_NOW };
  render(<CountersCard week={week} now={now} />);
}

describe('CountersCard', () => {
  it("shows the week's worked time, target and gap", () => {
    renderCard({ weekCountedWorkedMinutes: 1880, weekTargetMinutes: 2100, weekGapMinutes: -100 });

    expect(screen.getByText('31:20')).toBeInTheDocument();
    expect(screen.getByText('35:00')).toBeInTheDocument();
    expect(screen.getByText('−1:40')).toHaveAttribute('data-tone', 'negative');
  });

  it('shows the week and global balances as two labelled stats', () => {
    renderCard({ weekGapMinutes: -100, globalGapMinutes: 255 });

    const weekStat = screen.getByRole('region', { name: copy.counters.weekTitle });
    expect(within(weekStat).getByText('Semaine')).toBeInTheDocument();
    expect(within(weekStat).getByText('−1:40')).toBeInTheDocument();
    const globalStat = screen.getByRole('region', { name: copy.counters.globalTitle });
    expect(within(globalStat).getByText('Solde global')).toBeInTheDocument();
    expect(within(globalStat).getByText('+4:15')).toBeInTheDocument();
    // "Semaine" already names the value: no second "week gap" label.
    expect(screen.queryByText(/Écart/)).not.toBeInTheDocument();
  });

  it('highlights a balance when the server answers a new value', () => {
    const now = new Date(SERVER_NOW);
    const before = {
      ...weekFixture({ counters: { globalGapMinutes: 255, weekGapMinutes: -10 } }),
      serverNow: SERVER_NOW,
    };
    const after = {
      ...weekFixture({ counters: { globalGapMinutes: 300, weekGapMinutes: -10 } }),
      serverNow: SERVER_NOW,
    };
    const { rerender } = render(<CountersCard week={before} now={now} />);
    expect(screen.getByText('+4:15')).toHaveAttribute('data-highlighted', 'false');

    rerender(<CountersCard week={after} now={now} />);

    expect(screen.getByText('+5:00')).toHaveAttribute('data-highlighted', 'true');
    // The week gap did not move: it stays calm.
    expect(screen.getByText('−0:10')).toHaveAttribute('data-highlighted', 'false');
  });

  it('does not highlight the minute-by-minute poll or tick of a running period, only a real change', () => {
    const runningSince = '2026-11-06T14:00:00.000Z';
    const answer = (serverNow: string, globalGapMinutes: number) => ({
      ...weekFixture({ counters: { runningSince, globalGapMinutes } }),
      serverNow,
    });
    // Each poll answers one more minute run, as of its own serverNow.
    const { rerender } = render(
      <CountersCard week={answer('2026-11-06T14:30:00.000Z', 30)} now={new Date(SERVER_NOW)} />,
    );
    const polled = new Date('2026-11-06T14:31:00.000Z');
    rerender(<CountersCard week={answer('2026-11-06T14:31:00.000Z', 31)} now={polled} />);
    screen
      .getAllByText('+0:31')
      .forEach((value) => expect(value).toHaveAttribute('data-highlighted', 'false'));

    // The clock alone ticking on (no new answer) moves the shown value, not the highlight.
    const ticked = new Date('2026-11-06T14:45:00.000Z');
    rerender(<CountersCard week={answer('2026-11-06T14:31:00.000Z', 31)} now={ticked} />);
    const tickedValues = screen.getAllByText('+0:45');
    expect(tickedValues.length).toBeGreaterThan(0);
    tickedValues.forEach((value) => expect(value).toHaveAttribute('data-highlighted', 'false'));

    // A period added through the dialog moves the balance beyond the running time: highlight.
    rerender(<CountersCard week={answer('2026-11-06T14:31:00.000Z', 91)} now={polled} />);

    expect(screen.getByText('+1:31')).toHaveAttribute('data-highlighted', 'true');
  });

  it('shows a positive global gap in green, with its counting start', () => {
    renderCard({ globalGapMinutes: 255, countingStartDate: '2026-11-03' });

    expect(screen.getByText('+4:15')).toHaveAttribute('data-tone', 'positive');
    expect(screen.getByText(`${copy.counters.since} 3 nov. 2026`)).toBeInTheDocument();
  });

  it('shows the balance in red while a refusal is open', () => {
    renderCard({ hasOpenRefusal: true, globalGapMinutes: 255 });

    expect(screen.getByText('+4:15')).toHaveAttribute('data-tone', 'refused');
  });

  it('shows the refusal action only while a refusal is open', () => {
    const action = <button type="button">voir</button>;
    const open = { ...weekFixture({ counters: { hasOpenRefusal: true } }), serverNow: SERVER_NOW };
    const calm = { ...weekFixture({ counters: { hasOpenRefusal: false } }), serverNow: SERVER_NOW };
    const now = new Date(SERVER_NOW);
    const { rerender } = render(<CountersCard week={open} now={now} refusalAction={action} />);
    expect(screen.getByRole('button', { name: 'voir' })).toBeInTheDocument();

    rerender(<CountersCard week={calm} now={now} refusalAction={action} />);

    expect(screen.queryByRole('button', { name: 'voir' })).not.toBeInTheDocument();
  });

  it('shows a zero gap without color', () => {
    renderCard({
      weekCountedWorkedMinutes: 60,
      weekTargetMinutes: 2100,
      weekGapMinutes: 0,
      globalGapMinutes: 0,
    });

    const zeroGaps = screen.getAllByText('0:00');
    expect(zeroGaps).toHaveLength(2);
    zeroGaps.forEach((gap) => expect(gap).toHaveAttribute('data-tone', 'zero'));
  });

  it('says who reset the counter and when', () => {
    renderCard({
      lastReset: {
        id: 1,
        resetDate: '2026-11-03',
        authorName: 'Sophie Dubois',
        createdAt: '2026-11-03T09:00:00.000Z',
      },
    });

    expect(
      screen.getByText(
        `${copy.counters.lastResetPrefix} 3 nov. 2026 ${copy.counters.lastResetBy} Sophie Dubois`,
      ),
    ).toBeInTheDocument();
  });

  it('keeps both gaps and the worked time ticking while a period runs today', () => {
    renderCard(
      {
        runningSince: '2026-11-06T08:00:00.000Z',
        weekCountedWorkedMinutes: 600,
        weekTargetMinutes: 2100,
        weekGapMinutes: -30,
        globalGapMinutes: -30,
      },
      new Date('2026-11-06T15:00:00Z'),
    );

    // Half an hour after the server answered, the 30-minute deficit is gone.
    expect(screen.getAllByText('0:00')).toHaveLength(2);
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it("does not tick a past week's gap", () => {
    const pastWeek = weekFixture({
      isoWeek: '2026-W40',
      counters: {
        runningSince: '2026-11-06T08:00:00.000Z',
        weekCountedWorkedMinutes: 600,
        weekGapMinutes: -30,
        globalGapMinutes: -30,
        weekTargetMinutes: 2100,
      },
    });

    render(
      <CountersCard
        week={{ ...pastWeek, serverNow: SERVER_NOW }}
        now={new Date('2026-11-06T15:00:00Z')}
      />,
    );

    expect(screen.getByText('−0:30')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });
});
