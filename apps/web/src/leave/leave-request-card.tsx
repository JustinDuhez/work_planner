import { formatDayCount, type DayTypeView, type LeaveRequestView } from '@work-planner/domain';
import type { ReactNode } from 'react';
import { formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  approved: 'bg-emerald-50 text-emerald-800',
  refused: 'bg-rose-50 text-rose-800',
  cancelled: 'bg-zinc-100 text-zinc-600',
};

function statusLabel(request: LeaveRequestView): string {
  if (request.status === 'approved' && request.isAutoApproved) {
    return copy.leaveRequests.status.autoApproved;
  }
  return copy.leaveRequests.status[request.status];
}

export function periodText(request: LeaveRequestView, dayTypes: readonly DayTypeView[]): string {
  const label =
    dayTypes.find((type) => type.code === request.dayTypeCode)?.label ?? request.dayTypeCode;
  const period =
    request.startDate === request.endDate
      ? `${copy.leaveRequests.on} ${formatLongDate(request.startDate)}`
      : `${copy.leaveRequests.from} ${formatLongDate(request.startDate)} ${copy.leaveRequests.to} ${formatLongDate(request.endDate)}`;
  return `${label} · ${formatDayCount(request.halfDayCount)} · ${period}`;
}

export function LeaveRequestCard({
  request,
  dayTypes,
  showPerson,
  children,
}: {
  request: LeaveRequestView;
  dayTypes: readonly DayTypeView[];
  showPerson: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="space-y-2 rounded-card border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showPerson ? (
            <p className="font-medium text-zinc-900">{`${request.user.firstName} ${request.user.lastName}`}</p>
          ) : null}
          <p className="text-sm text-zinc-700">{periodText(request, dayTypes)}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[request.status] ?? ''}`}
        >
          {statusLabel(request)}
        </span>
      </div>
      {request.reason ? <p className="text-sm text-zinc-600">{request.reason}</p> : null}
      {request.ruleNote ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {request.ruleNote}
        </p>
      ) : null}
      {request.reviewComment ? (
        <p className="text-sm text-zinc-600">
          {request.reviewer
            ? `${copy.leaveRequests.reviewedBy} ${request.reviewer.firstName} ${request.reviewer.lastName} : `
            : ''}
          <span>{request.reviewComment}</span>
        </p>
      ) : null}
      {children}
    </li>
  );
}
