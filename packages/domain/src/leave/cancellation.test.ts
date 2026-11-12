import { canCancelLeaveRequest } from './cancellation';

const TODAY = '2026-11-12';

describe('canCancelLeaveRequest', () => {
  it.each([
    ['a pending request starting today', { status: 'pending', startDate: TODAY }, true],
    ['a pending request that has started', { status: 'pending', startDate: '2026-11-02' }, true],
    [
      'an approved request starting tomorrow',
      { status: 'approved', startDate: '2026-11-13' },
      true,
    ],
    ['an approved request starting today', { status: 'approved', startDate: TODAY }, false],
    ['a refused request', { status: 'refused', startDate: '2026-11-20' }, false],
    ['a cancelled request', { status: 'cancelled', startDate: '2026-11-20' }, false],
  ] as const)('answers for %s', (_what, request, canCancel) => {
    expect(canCancelLeaveRequest(request, TODAY)).toBe(canCancel);
  });
});
