import { toWorkDate } from '@work-planner/domain';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryClient } from '../api/query-client';
import { copy } from '../copy';
import { weekFixture } from '../test/clock-fixtures';
import { mockFetchRoutes } from '../test/mock-fetch';
import { APP_TIME_ZONE, currentIsoWeek } from './clock-time';
import { TodayControls } from './today-controls';

const TODAY = toWorkDate(new Date(), APP_TIME_ZONE);
const ISO_WEEK = currentIsoWeek(new Date());
const TELEWORK_DAY = {
  halfDays: { am: { dayTypeCode: 'telework', status: 'approved' }, pm: null },
};

function dayWith(overrides: object) {
  const day = weekFixture({ days: { [TODAY]: overrides } }).days.find((d) => d.date === TODAY);
  if (!day) throw new Error('no today');
  return day;
}

function controls(day: ReturnType<typeof dayWith>) {
  return (
    <QueryClientProvider client={createQueryClient({ shouldRetry: false })}>
      <TodayControls day={day} ownerId={7} isoWeek={ISO_WEEK} onAddPeriod={() => undefined} />
    </QueryClientProvider>
  );
}

describe('TodayControls work mode pre-fill', () => {
  it('follows a telework approved while the page is open', () => {
    const { rerender } = render(controls(dayWith({})));
    expect(screen.getByRole('radio', { name: copy.clock.onSite })).toBeChecked();

    rerender(controls(dayWith(TELEWORK_DAY)));

    expect(screen.getByRole('radio', { name: copy.clock.telework })).toBeChecked();
  });

  it('keeps an explicit on-site choice over the planned telework', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchRoutes({
      'POST /api/v1/clock-periods': {
        status: 201,
        body: { id: 1, startedAt: new Date().toISOString(), endedAt: null },
      },
    });
    render(controls(dayWith(TELEWORK_DAY)));

    await user.click(screen.getByRole('radio', { name: copy.clock.onSite }));
    await user.click(screen.getByRole('button', { name: copy.clock.start }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ workMode: 'on_site' });
  });
});
