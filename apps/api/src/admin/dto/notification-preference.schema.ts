import { z } from 'zod';
import { NOTIFICATION_CHANNELS } from '@repo/shared/notification-channel';

export const notificationPreferenceSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  channelIdentifier: z.string().min(1),
  isPrimary: z.boolean().optional().default(true),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
