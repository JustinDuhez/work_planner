import { z } from 'zod';
import { clockCorrectionStatusSchema } from './correction-status';
import { workDateSchema } from './work-date';

export const NOTIFICATION_TYPES = [
  'clock_correction_received',
  'clock_correction_answered',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationPayloadSchema = z.object({
  correctionId: z.number().int(),
  // The person whose day was corrected: the link opens their week.
  ownerId: z.number().int(),
  workDate: workDateSchema,
  actorName: z.string(),
  status: clockCorrectionStatusSchema.optional(),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export const notificationSchema = z.object({
  id: z.number().int(),
  type: z.enum(NOTIFICATION_TYPES),
  payload: notificationPayloadSchema,
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

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
