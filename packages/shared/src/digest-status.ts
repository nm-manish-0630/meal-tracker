export const DIGEST_STATUSES = ['pending', 'sent', 'failed_permanent'] as const;

export type DigestStatus = (typeof DIGEST_STATUSES)[number];
