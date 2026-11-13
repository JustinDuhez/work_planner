import { z } from 'zod';
import { userSummarySchema } from './clock';
import { publicHolidaySchema } from './holidays';
import { workDateSchema } from './work-date';

export const HALVES = ['am', 'pm'] as const;
export type Half = (typeof HALVES)[number];
export const halfSchema = z.enum(HALVES, 'Demi-journée invalide.');

export const LEAVE_STATUSES = ['pending', 'approved', 'refused', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const leaveStatusSchema = z.enum(LEAVE_STATUSES);

export const MAX_LEAVE_TEXT_LENGTH = 500;
const UNKNOWN_FIELDS_MESSAGE = 'Champs non autorisés.';
const leaveTextSchema = z
  .string()
  .trim()
  .max(MAX_LEAVE_TEXT_LENGTH, `${MAX_LEAVE_TEXT_LENGTH} caractères maximum.`);

export const dayTypeSchema = z.object({
  code: z.string(),
  label: z.string(),
  color: z.string(),
  requiresApproval: z.boolean(),
  isBadgeable: z.boolean(),
  isRequestable: z.boolean(),
});
export type DayTypeView = z.infer<typeof dayTypeSchema>;
export const dayTypeListSchema = z.array(dayTypeSchema);

export const createLeaveRequestRequestSchema = z.strictObject(
  {
    dayTypeCode: z.string().min(1, 'Choisissez un type.'),
    startDate: workDateSchema,
    startHalf: halfSchema,
    endDate: workDateSchema,
    endHalf: halfSchema,
    reason: leaveTextSchema.optional(),
  },
  { error: UNKNOWN_FIELDS_MESSAGE },
);
export type CreateLeaveRequestRequest = z.infer<typeof createLeaveRequestRequestSchema>;

export const LEAVE_DECISIONS = ['approved', 'refused'] as const;
export const reviewLeaveRequestRequestSchema = z.strictObject(
  { decision: z.enum(LEAVE_DECISIONS, 'Décision invalide.'), comment: leaveTextSchema.optional() },
  { error: UNKNOWN_FIELDS_MESSAGE },
);
export type ReviewLeaveRequestRequest = z.infer<typeof reviewLeaveRequestRequestSchema>;

export const leaveRequestSchema = z.object({
  id: z.number().int(),
  user: userSummarySchema,
  dayTypeCode: z.string(),
  startDate: workDateSchema,
  startHalf: halfSchema,
  endDate: workDateSchema,
  endHalf: halfSchema,
  halfDayCount: z.number().int(),
  status: leaveStatusSchema,
  reason: z.string().nullable(),
  ruleNote: z.string().nullable(),
  isAutoApproved: z.boolean(),
  reviewer: userSummarySchema.nullable(),
  declaredBy: userSummarySchema.nullable(),
  reviewComment: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  canReview: z.boolean(),
  canCancel: z.boolean(),
});
export type LeaveRequestView = z.infer<typeof leaveRequestSchema>;
export const leaveRequestListSchema = z.array(leaveRequestSchema);

export const leaveReviewInboxSchema = z.object({
  pending: z.array(leaveRequestSchema),
  recent: z.array(leaveRequestSchema),
});
export type LeaveReviewInbox = z.infer<typeof leaveReviewInboxSchema>;

export const calendarHalfDaySchema = z.object({
  date: workDateSchema,
  half: halfSchema,
  dayTypeCode: z.string(),
  status: z.enum(['pending', 'approved']),
  leaveRequestId: z.number().int(),
});
export type CalendarHalfDay = z.infer<typeof calendarHalfDaySchema>;

export const leaveUsageSchema = z.object({
  dayTypeCode: z.string(),
  approvedHalfDays: z.number().int(),
  pendingHalfDays: z.number().int(),
});

export const yearCalendarSchema = z.object({
  user: userSummarySchema,
  period: z.object({ startDate: workDateSchema, endDate: workDateSchema }),
  halfDays: z.array(calendarHalfDaySchema),
  holidays: z.array(publicHolidaySchema),
  summary: z.array(leaveUsageSchema),
  holidayCount: z.number().int(),
  canDeclare: z.boolean(),
  today: workDateSchema,
});
export type YearCalendar = z.infer<typeof yearCalendarSchema>;
