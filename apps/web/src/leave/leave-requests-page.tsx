import type { DayTypeView, LeaveRequestView } from '@work-planner/domain';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { bannerMessageFor } from '../api/form-errors';
import { copy } from '../copy';
import { ErrorBanner, fieldErrorsOf } from '../directory/manage-user-dialog';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { LeaveRequestCard } from './leave-request-card';
import {
  useCancelLeaveRequest,
  useDayTypes,
  useLeaveInbox,
  useOwnLeaveRequests,
  useReviewLeaveRequest,
} from './leave-queries';

const TAB_PARAM = 'onglet';
const MINE_TAB = 'mes-demandes';
const TO_REVIEW_TAB = 'a-valider';

function CancelAction({ request }: { request: LeaveRequestView }) {
  const cancel = useCancelLeaveRequest(request.id);
  const [isConfirming, setIsConfirming] = useState(false);
  if (!request.canCancel) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isConfirming ? (
        <>
          <span className="text-sm text-zinc-700">{copy.leaveRequests.confirmCancelQuestion}</span>
          <Button onClick={() => cancel.mutate()} isPending={cancel.isPending}>
            {copy.leaveRequests.confirmCancel}
          </Button>
          <Button variant="secondary" onClick={() => setIsConfirming(false)}>
            {copy.leaveRequests.keep}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setIsConfirming(true)}>
          {copy.leaveRequests.cancel}
        </Button>
      )}
      <ErrorBanner message={bannerMessageFor(cancel.error, [])} />
    </div>
  );
}

function ReviewActions({ request }: { request: LeaveRequestView }) {
  const review = useReviewLeaveRequest(request.id);
  const [decision, setDecision] = useState<'approved' | 'refused' | null>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string>();
  if (!request.canReview) {
    return <p className="text-xs text-zinc-500">{copy.leaveRequests.decidedByDirectManager}</p>;
  }

  function confirm() {
    if (decision === 'refused' && comment.trim() === '') {
      setCommentError(copy.leaveRequests.commentRequired);
      return;
    }
    setCommentError(undefined);
    review.mutate({
      decision: decision ?? 'approved',
      ...(comment.trim() === '' ? {} : { comment: comment.trim() }),
    });
  }

  if (decision === null) {
    return (
      <div className="flex gap-2">
        <Button onClick={() => setDecision('approved')}>{copy.leaveRequests.approve}</Button>
        <Button variant="secondary" onClick={() => setDecision('refused')}>
          {copy.leaveRequests.refuse}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <TextField
        label={copy.leaveRequests.comment}
        name="comment"
        value={comment}
        onChange={setComment}
        error={commentError ?? fieldErrorsOf(review.error).comment}
      />
      <div className="flex gap-2">
        <Button onClick={confirm} isPending={review.isPending}>
          {decision === 'approved'
            ? copy.leaveRequests.confirmApprove
            : copy.leaveRequests.confirmRefuse}
        </Button>
        <Button variant="secondary" onClick={() => setDecision(null)}>
          {copy.leaveRequests.keep}
        </Button>
      </div>
      <ErrorBanner message={bannerMessageFor(review.error, ['comment'])} />
    </div>
  );
}

function LoadError() {
  return (
    <p role="alert" className="text-sm text-rose-700">
      {copy.leaveRequests.loadError}
    </p>
  );
}

function MineTab({ dayTypes }: { dayTypes: readonly DayTypeView[] }) {
  const requests = useOwnLeaveRequests();
  if (requests.isError) return <LoadError />;
  if (requests.data?.length === 0) {
    return <p className="text-sm text-zinc-500">{copy.leaveRequests.noRequests}</p>;
  }
  return (
    <ul className="space-y-2">
      {(requests.data ?? []).map((request) => (
        <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson={false}>
          <CancelAction request={request} />
        </LeaveRequestCard>
      ))}
    </ul>
  );
}

function ToReviewTab({ dayTypes }: { dayTypes: readonly DayTypeView[] }) {
  const inbox = useLeaveInbox(true);
  if (inbox.isError) return <LoadError />;
  const recent = inbox.data?.recent ?? [];
  return (
    <div className="space-y-6">
      {inbox.data?.pending.length === 0 ? (
        <p className="text-sm text-zinc-500">{copy.leaveRequests.noPending}</p>
      ) : null}
      <ul className="space-y-2">
        {(inbox.data?.pending ?? []).map((request) => (
          <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson>
            <ReviewActions request={request} />
          </LeaveRequestCard>
        ))}
      </ul>
      {recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">{copy.leaveRequests.recentTitle}</h2>
          <ul className="space-y-2">
            {recent.map((request) => (
              <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function LeaveRequestsPage() {
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const dayTypes = useDayTypes();
  const canSeeInbox =
    (session?.user.roles.isAdmin ?? false) || (session?.user.roles.isManager ?? false);
  // Same query key as the tab's call: one request feeds both the badge and the list.
  const inbox = useLeaveInbox(canSeeInbox);
  const tab =
    canSeeInbox && searchParams.get(TAB_PARAM) === TO_REVIEW_TAB ? TO_REVIEW_TAB : MINE_TAB;
  const pendingCount = inbox.data?.pending.filter((request) => request.canReview).length ?? 0;
  const tabClass = (isActive: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-white font-medium text-zinc-900 shadow-card' : 'text-zinc-600'}`;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{copy.leaveRequests.title}</h1>
      <div role="tablist" className="inline-flex gap-1 rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === MINE_TAB}
          onClick={() => setSearchParams({ [TAB_PARAM]: MINE_TAB })}
          className={tabClass(tab === MINE_TAB)}
        >
          {copy.leaveRequests.mineTab}
        </button>
        {canSeeInbox ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === TO_REVIEW_TAB}
            onClick={() => setSearchParams({ [TAB_PARAM]: TO_REVIEW_TAB })}
            className={tabClass(tab === TO_REVIEW_TAB)}
          >
            {copy.leaveRequests.toReviewTab}
            {pendingCount > 0 ? (
              <span className="ml-1 rounded-full bg-primary-600 px-1.5 text-xs text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      <div role="tabpanel">
        {tab === MINE_TAB ? (
          <MineTab dayTypes={dayTypes.data ?? []} />
        ) : (
          <ToReviewTab dayTypes={dayTypes.data ?? []} />
        )}
      </div>
    </section>
  );
}
