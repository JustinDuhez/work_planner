import { toWorkDate, type DayTypeView, type LeaveRequestView } from '@work-planner/domain';
import { CalendarPlus, Inbox } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { bannerMessageFor } from '../api/form-errors';
import { APP_TIME_ZONE } from '../clock/clock-time';
import { copy } from '../copy';
import { fieldErrorsOf } from '../directory/manage-user-dialog';
import { ErrorBanner } from '../ui/error-banner';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { PageLayout } from '../ui/page-layout';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { SummarySkeleton } from '../ui/summary-skeleton';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { LoadingRegion } from '../ui/skeleton';
import { TextField } from '../ui/text-field';
import { LeaveRequestCard } from './leave-request-card';
import { LeaveRequestDialog } from './leave-request-dialog';
import { RequestsSkeleton } from './requests-skeleton';
import { RequestsSummaryCard } from './requests-summary-card';
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
  function cancelDecision() {
    setComment('');
    setCommentError(undefined);
    review.reset();
    setDecision(null);
  }

  const confirm = () => {
    if (decision === 'refused' && comment.trim() === '') {
      setCommentError(copy.leaveRequests.commentRequired);
      return;
    }
    review.mutate({
      decision,
      ...(comment.trim() === '' ? {} : { comment: comment.trim() }),
    });
  };

  return (
    <div className="space-y-2">
      <TextField
        label={copy.leaveRequests.comment}
        name="comment"
        value={comment}
        onChange={(value) => {
          setComment(value);
          setCommentError(undefined);
        }}
        error={commentError ?? fieldErrorsOf(review.error).comment}
      />
      <div className="flex gap-2">
        <Button onClick={confirm} isPending={review.isPending}>
          {decision === 'approved'
            ? copy.leaveRequests.confirmApprove
            : copy.leaveRequests.confirmRefuse}
        </Button>
        <Button variant="secondary" onClick={cancelDecision}>
          {copy.leaveRequests.keep}
        </Button>
      </div>
      <ErrorBanner message={bannerMessageFor(review.error, ['comment'])} />
    </div>
  );
}

function RequestsLoading() {
  return (
    <LoadingRegion label={copy.leaveRequests.loading}>
      <RequestsSkeleton />
    </LoadingRegion>
  );
}

function RequestList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
      {children}
    </ul>
  );
}

function NoRequests({ message }: { message: string }) {
  return <EmptyState icon={Inbox} message={message} />;
}

function MineTab({ dayTypes }: { dayTypes: readonly DayTypeView[] }) {
  const requests = useOwnLeaveRequests();
  if (requests.isError && !requests.data) {
    return (
      <ErrorState
        message={copy.leaveRequests.loadError}
        onRetry={() => void requests.refetch()}
        isRetrying={requests.isFetching}
      />
    );
  }
  if (requests.isPending) return <RequestsLoading />;
  if (requests.data?.length === 0) return <NoRequests message={copy.leaveRequests.noRequests} />;
  return (
    <RequestList>
      {(requests.data ?? []).map((request) => (
        <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson={false}>
          <CancelAction request={request} />
        </LeaveRequestCard>
      ))}
    </RequestList>
  );
}

function ToReviewTab({ dayTypes }: { dayTypes: readonly DayTypeView[] }) {
  const inbox = useLeaveInbox(true);
  if (inbox.isError && !inbox.data) {
    return (
      <ErrorState
        message={copy.leaveRequests.loadError}
        onRetry={() => void inbox.refetch()}
        isRetrying={inbox.isFetching}
      />
    );
  }
  if (inbox.isPending) return <RequestsLoading />;
  const recent = inbox.data?.recent ?? [];
  return (
    <div className="space-y-6">
      {inbox.data?.pending.length === 0 ? (
        <NoRequests message={copy.leaveRequests.noPending} />
      ) : null}
      {(inbox.data?.pending ?? []).length > 0 ? (
        <RequestList>
          {(inbox.data?.pending ?? []).map((request) => (
            <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson>
              <ReviewActions request={request} />
              <CancelAction request={request} />
            </LeaveRequestCard>
          ))}
        </RequestList>
      ) : null}
      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">{copy.leaveRequests.recentTitle}</h2>
          <RequestList>
            {recent.map((request) => (
              <LeaveRequestCard key={request.id} request={request} dayTypes={dayTypes} showPerson>
                <CancelAction request={request} />
              </LeaveRequestCard>
            ))}
          </RequestList>
        </section>
      ) : null}
    </div>
  );
}

export function LeaveRequestsPage() {
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const dayTypes = useDayTypes();
  // Set when the dialog opens, so its date does not move while it is open.
  const [requestDate, setRequestDate] = useState<string | null>(null);
  const canSeeInbox =
    (session?.user.roles.isAdmin ?? false) || (session?.user.roles.isManager ?? false);
  // Same query key as the tab's call: one request feeds both the badge and the list.
  const inbox = useLeaveInbox(canSeeInbox);
  const tab =
    canSeeInbox && searchParams.get(TAB_PARAM) === TO_REVIEW_TAB ? TO_REVIEW_TAB : MINE_TAB;
  const pendingCount = inbox.data?.pending.filter((request) => request.canReview).length ?? 0;
  const mine = useOwnLeaveRequests();
  const tabs = [
    { id: MINE_TAB, label: copy.leaveRequests.mineTab },
    ...(canSeeInbox
      ? [
          {
            id: TO_REVIEW_TAB,
            label:
              pendingCount > 0
                ? `${copy.leaveRequests.toReviewTab} · ${pendingCount}`
                : copy.leaveRequests.toReviewTab,
          },
        ]
      : []),
  ].map((entry) => ({ ...entry, panelId: `panel-${entry.id}` }));
  const isSummaryReady = mine.data && (!canSeeInbox || inbox.data);

  return (
    <section>
      <PageLayout
        bar={
          <>
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              {copy.leaveRequests.title}
            </h1>
            <Button onClick={() => setRequestDate(toWorkDate(new Date(), APP_TIME_ZONE))}>
              <CalendarPlus size={16} aria-hidden /> {copy.leave.requestButton}
            </Button>
          </>
        }
        main={
          <div className="space-y-4">
            <SegmentedTabs
              label={copy.leaveRequests.tabsLabel}
              tabs={tabs}
              selectedId={tab}
              onSelect={(id) => setSearchParams({ [TAB_PARAM]: id })}
            />
            {tabs.map(({ id, panelId }) => (
              <div
                key={id}
                role="tabpanel"
                id={panelId}
                aria-labelledby={`tab-${id}`}
                hidden={id !== tab}
              >
                {id !== tab ? null : id === MINE_TAB ? (
                  <MineTab dayTypes={dayTypes.data ?? []} />
                ) : (
                  <ToReviewTab dayTypes={dayTypes.data ?? []} />
                )}
              </div>
            ))}
          </div>
        }
        aside={
          isSummaryReady ? (
            <RequestsSummaryCard
              mine={mine.data}
              toReviewCount={canSeeInbox ? pendingCount : null}
              now={Date.now()}
            />
          ) : mine.isPending || (canSeeInbox && inbox.isPending) ? (
            <SummarySkeleton />
          ) : undefined
        }
      />
      {requestDate ? (
        // The browser date is enough here: minDate is only a picker hint, the server refuses past dates.
        <LeaveRequestDialog
          initialDate={requestDate}
          minDate={requestDate}
          onClose={() => setRequestDate(null)}
        />
      ) : null}
    </section>
  );
}
