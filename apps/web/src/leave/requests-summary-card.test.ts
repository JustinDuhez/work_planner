import { leaveRequestView } from '../test/leave-fixtures';
import { approvedRecently } from './requests-summary-card';

const NOW = Date.parse('2026-11-17T09:00:00.000Z');
const approved = (reviewedAt: string | null, createdAt = '2026-01-01T09:00:00.000Z') =>
  leaveRequestView({ status: 'approved', reviewedAt, createdAt });

describe('approvedRecently', () => {
  it('counts an approval exactly 30 days old', () => {
    expect(approvedRecently([approved('2026-10-18T09:00:00.000Z')], NOW)).toBe(1);
  });

  it('does not count an approval 31 days old', () => {
    expect(approvedRecently([approved('2026-10-17T09:00:00.000Z')], NOW)).toBe(0);
  });

  it('dates an approval by its creation when it has no review date', () => {
    expect(approvedRecently([approved(null, '2026-11-12T09:00:00.000Z')], NOW)).toBe(1);
  });

  it('is 0 when only old approvals or other statuses exist', () => {
    const pending = leaveRequestView({ status: 'pending', createdAt: '2026-11-16T09:00:00.000Z' });
    expect(approvedRecently([approved('2026-09-01T09:00:00.000Z'), pending], NOW)).toBe(0);
  });
});
