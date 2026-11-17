import type { LeaveRequestView } from '@work-planner/domain';
import { copy } from '../copy';
import { Stat } from '../ui/stat';
import { SummaryCard } from '../ui/summary-card';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Own approved requests decided (or created, for automatic approvals) within the 30 days up to
 * `now`.
 */
export function approvedRecently(requests: readonly LeaveRequestView[], now: number): number {
  const since = now - WINDOW_MS;
  return requests.filter((request) => {
    const decidedAt = Date.parse(request.reviewedAt ?? request.createdAt);
    return request.status === 'approved' && decidedAt >= since && decidedAt <= now;
  }).length;
}

export function RequestsSummaryCard({
  mine,
  toReviewCount,
  now,
}: {
  mine: readonly LeaveRequestView[];
  /** Null for a collaborator: there is no inbox to count. */
  toReviewCount: number | null;
  now: number;
}) {
  return (
    <SummaryCard title={copy.leaveRequests.summary.title}>
      {toReviewCount === null ? null : (
        <Stat label={copy.leaveRequests.summary.toReview} value={String(toReviewCount)} />
      )}
      <Stat
        label={copy.leaveRequests.summary.pending}
        value={String(mine.filter((request) => request.status === 'pending').length)}
        size={toReviewCount === null ? 'lg' : 'md'}
      />
      <Stat
        label={copy.leaveRequests.summary.approved}
        value={String(approvedRecently(mine, now))}
        size="md"
      />
    </SummaryCard>
  );
}
