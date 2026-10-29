export const DIGEST_RUN_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export type DigestRunStatus = (typeof DIGEST_RUN_STATUSES)[number];
