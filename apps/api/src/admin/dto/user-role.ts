export const USER_ROLES = ['client', 'trainer'] as const;

export type UserRole = (typeof USER_ROLES)[number];
