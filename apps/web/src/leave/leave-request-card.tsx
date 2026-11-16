import { formatDayCount, type DayTypeView, type LeaveRequestView } from '@work-planner/domain';
import type { ReactNode } from 'react';
import { formatLongDate } from '../clock/clock-time';
import { copy } from '../copy';

const STATUS_CLASS: Record<LeaveRequestView['status'], string> = {
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

function typeLabel(request: LeaveRequestView, dayTypes: readonly DayTypeView[]): string {
  return dayTypes.find((type) => type.code === request.dayTypeCode)?.label ?? request.dayTypeCode;
}

function periodText(request: LeaveRequestView): string {
  const period =
    request.startDate === request.endDate
      ? `${copy.leaveRequests.on} ${formatLongDate(request.startDate)}`
      : `${copy.leaveRequests.from} ${formatLongDate(request.startDate)} ${copy.leaveRequests.to} ${formatLongDate(request.endDate)}`;
  return `${formatDayCount(request.halfDayCount)} · ${period}`;
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
    <li className="space-y-2 rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {showPerson ? (
            <p className="text-xs font-medium text-zinc-500">{`${request.user.firstName} ${request.user.lastName}`}</p>
          ) : null}
          <p className="font-medium text-zinc-900">{typeLabel(request, dayTypes)}</p>
          <p className="text-sm text-zinc-600">{periodText(request)}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[request.status]}`}
        >
          {statusLabel(request)}
        </span>
      </div>
      {request.reason ? <p className="text-sm text-zinc-600">{request.reason}</p> : null}
      {request.ruleNote ? (
        <p className="rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {request.ruleNote}
        </p>
      ) : null}
      {request.declaredBy ? (
        <p className="text-sm text-zinc-600">
          {`${copy.leaveRequests.declaredBy} ${request.declaredBy.firstName} ${request.declaredBy.lastName}`}
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
