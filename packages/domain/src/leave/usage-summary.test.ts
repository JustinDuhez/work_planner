import { summarizeLeaveUsage } from './usage-summary';

const ORDER = ['on_site', 'telework', 'sick', 'leave'];

describe('summarizeLeaveUsage', () => {
  it('counts approved and pending half-days per type, in day-type order', () => {
    const summary = summarizeLeaveUsage(
      [
        { dayTypeCode: 'leave', status: 'approved' },
        { dayTypeCode: 'leave', status: 'approved' },
        { dayTypeCode: 'leave', status: 'pending' },
        { dayTypeCode: 'telework', status: 'approved' },
      ],
      ORDER,
    );

    expect(summary).toEqual([
      { dayTypeCode: 'telework', approvedHalfDays: 1, pendingHalfDays: 0 },
      { dayTypeCode: 'leave', approvedHalfDays: 2, pendingHalfDays: 1 },
    ]);
  });

  it('lists nothing when nothing is declared', () => {
    expect(summarizeLeaveUsage([], ORDER)).toEqual([]);
  });

  it('puts an unknown type last', () => {
    expect(
      summarizeLeaveUsage(
        [
          { dayTypeCode: 'mystery', status: 'approved' },
          { dayTypeCode: 'sick', status: 'approved' },
        ],
        ORDER,
      ).map((usage) => usage.dayTypeCode),
    ).toEqual(['sick', 'mystery']);
  });
});
