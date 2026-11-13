export interface LeaveUsage {
  dayTypeCode: string;
  approvedHalfDays: number;
  pendingHalfDays: number;
}

/** D4: usage, never balances — only the types used in the period, in day-type order. */
export function summarizeLeaveUsage(
  halfDays: readonly { dayTypeCode: string; status: 'pending' | 'approved' }[],
  dayTypeOrder: readonly string[],
): LeaveUsage[] {
  const usageByCode = new Map<string, LeaveUsage>();
  for (const halfDay of halfDays) {
    const usage = usageByCode.get(halfDay.dayTypeCode) ?? {
      dayTypeCode: halfDay.dayTypeCode,
      approvedHalfDays: 0,
      pendingHalfDays: 0,
    };
    if (halfDay.status === 'approved') usage.approvedHalfDays += 1;
    else usage.pendingHalfDays += 1;
    usageByCode.set(halfDay.dayTypeCode, usage);
  }
  const rank = (code: string) => {
    const index = dayTypeOrder.indexOf(code);
    return index === -1 ? dayTypeOrder.length : index;
  };
  return [...usageByCode.values()].sort(
    (first, second) => rank(first.dayTypeCode) - rank(second.dayTypeCode),
  );
}
