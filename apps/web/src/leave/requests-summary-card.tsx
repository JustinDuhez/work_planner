import type { LeaveRequestView } from '@work-planner/domain';
import { copy } from '../copy';
import { Stat } from '../ui/stat';
import { SummaryCard } from '../ui/summary-card';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Own approved requests decided within 30 days of the newest date in the payload (no browser
 * date, so the number does not depend on today). Null when the payload carries no date.
 */
export function approvedRecently(requests: readonly LeaveRequestView[]): number | null {
  const times = requests.flatMap((request) =>
    [request.createdAt, request.reviewedAt].flatMap((date) => (date ? [Date.parse(date)] : [])),
  );
  if (times.length === 0) return null;
  const since = Math.max(...times) - WINDOW_MS;
  return requests.filter(
    (request) =>
      request.status === 'approved' && Date.parse(request.reviewedAt ?? request.createdAt) >= since,
  ).length;
}

export function RequestsSummaryCard({
  mine,
  toReviewCount,
}: {
  mine: readonly LeaveRequestView[];
  /** Null for a collaborator: there is no inbox to count. */
  toReviewCount: number | null;
}) {
  const approved = approvedRecently(mine);
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
      {approved === null ? null : (
        <Stat label={copy.leaveRequests.summary.approved} value={String(approved)} size="md" />
      )}
    </SummaryCard>
  );
}
