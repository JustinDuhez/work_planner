import { z } from 'zod';
import { clockCorrectionStatusSchema } from './correction-status';
import { LEAVE_DECISIONS } from './leave';
import { workDateSchema } from './work-date';

export const CORRECTION_NOTIFICATION_TYPES = [
  'clock_correction_received',
  'clock_correction_answered',
] as const;
export const LEAVE_NOTIFICATION_TYPES = [
  'leave_request_received',
  'leave_request_reviewed',
  'leave_request_cancelled',
  'leave_request_declared',
  'leave_request_withdrawn',
] as const;
export const NOTIFICATION_TYPES = [
  ...CORRECTION_NOTIFICATION_TYPES,
  ...LEAVE_NOTIFICATION_TYPES,
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const correctionNotificationPayloadSchema = z.object({
  correctionId: z.number().int(),
  // The person whose day was corrected: the link opens their week.
  ownerId: z.number().int(),
  workDate: workDateSchema,
  actorName: z.string(),
  status: clockCorrectionStatusSchema.optional(),
});
export type CorrectionNotificationPayload = z.infer<typeof correctionNotificationPayloadSchema>;

export const leaveNotificationPayloadSchema = z.object({
  leaveRequestId: z.number().int(),
  actorName: z.string(),
  dayTypeLabel: z.string(),
  startDate: workDateSchema,
  endDate: workDateSchema,
  decision: z.enum(LEAVE_DECISIONS).optional(),
});
export type LeaveNotificationPayload = z.infer<typeof leaveNotificationPayloadSchema>;

export type NotificationPayload = CorrectionNotificationPayload | LeaveNotificationPayload;

/** A type always travels with its payload shape, so callers cannot mix them. */
export type NotificationInput =
  | {
      type: (typeof CORRECTION_NOTIFICATION_TYPES)[number];
      payload: CorrectionNotificationPayload;
    }
  | { type: (typeof LEAVE_NOTIFICATION_TYPES)[number]; payload: LeaveNotificationPayload };

const notificationBase = {
  id: z.number().int(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
};

export const notificationSchema = z.union([
  z.object({
    ...notificationBase,
    type: z.enum(CORRECTION_NOTIFICATION_TYPES),
    payload: correctionNotificationPayloadSchema,
  }),
  z.object({
    ...notificationBase,
    type: z.enum(LEAVE_NOTIFICATION_TYPES),
    payload: leaveNotificationPayloadSchema,
  }),
]);
export type NotificationView = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  unreadCount: z.number().int(),
  notifications: z.array(notificationSchema),
});

export type NotificationList = z.infer<typeof notificationListSchema>;

export const markNotificationReadRequestSchema = z.strictObject(
  { isRead: z.literal(true) },
  { error: 'Champs non autorisés.' },
);
