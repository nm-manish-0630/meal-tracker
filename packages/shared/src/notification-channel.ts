export const NOTIFICATION_CHANNELS = ['slack', 'email'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
