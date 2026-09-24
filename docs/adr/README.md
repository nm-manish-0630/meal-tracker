# Architecture Decision Records

Meal Tracker — key technical decisions & rationale, in chronological order. Where a later ADR amends, corrects, or supersedes an earlier one, both are noted below and cross-referenced inline.

| ADR                                                    | Title                                                                      | Status                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [0001](0001-photo-storage-method.md)                   | Photo Storage — PostgreSQL BYTEA vs S3                                     | Superseded by ADR-007                                                                               |
| [0002](0002-hosting-platform.md)                       | Hosting Platform — Vercel + Neon vs VPS                                    | Accepted                                                                                            |
| [0003](0003-daily-digest-trigger-mechanism.md)         | Daily Digest Trigger — GitHub Actions vs Internal Cron                     | Accepted                                                                                            |
| [0004](0004-authentication-strategy.md)                | Authentication Strategy                                                    | Accepted                                                                                            |
| [0005](0005-client-trainer-relationship-modeling.md)   | Client-Trainer Relationship — Junction Table                               | Accepted                                                                                            |
| [0006](0006-notification-channel-storage.md)           | Notification Channel — Preferences Table vs Direct Column                  | Accepted                                                                                            |
| [0007](0007-photo-storage-revised-r2.md)               | Photo Storage, Revised — Cloudflare R2 via Presigned Uploads               | Accepted — supersedes ADR-001                                                                       |
| [0008](0008-slack-image-delivery.md)                   | Slack Image Delivery — Native File Upload vs Presigned URL                 | Accepted                                                                                            |
| [0009](0009-upload-reliability-orphaned-r2-cleanup.md) | Upload Reliability — Orphaned R2 Object Cleanup                            | Accepted                                                                                            |
| [0010](0010-digest-delivery-reliability.md)            | Digest Delivery Reliability — Idempotent, Retryable Slack Posting          | Accepted — refines ADR-003 and ADR-008                                                              |
| [0011](0011-late-photo-delivery-7-day-catchup.md)      | Late Photo Delivery — 7-Day Catch-Up Window                                | Accepted — mechanism superseded by ADR-012; catch-up timing further revised by ADR-013              |
| [0012](0012-event-driven-enqueue.md)                   | Event-Driven Enqueue — Replacing the Hourly Catch-Up Scan                  | Accepted — supersedes ADR-011's mechanism (not its decisions); drain eligibility revised by ADR-013 |
| [0013](0013-single-daily-digest-message.md)            | Single Daily Digest Message — Consolidating Same-Day and Catch-Up Delivery | Accepted — amends ADR-010 (schema), ADR-011 (catch-up timing), ADR-012 (drain eligibility)          |
| [0014](0014-per-day-shareable-routes.md)               | Per-Day Shareable Routes with Meal-Type Anchors                            | Accepted — role-split claim corrected by ADR-015                                                    |
| [0015](0015-meal-management-controls-shared-page.md)   | Meal Management Controls Live on the Shared Per-Day Page                   | Accepted                                                                                            |

## Reading order for a new contributor

If you're implementing this app for the first time, the ADRs build on each other in a way that's easier to follow as threads than as a flat list:

- **Storage:** 0001 → 0007 (R2 replaces BYTEA) → 0008 (how photos reach Slack) → 0009 (orphan cleanup)
- **Digest delivery:** 0003 (trigger) → 0010 (retry queue) → 0011 (catch-up window) → 0012 (event-driven enqueue) → 0013 (consolidated single message) — 0010 through 0013 in particular each amend the schema and mechanism of the one before, so read them in order, not independently
- **Access model:** 0004 (no login) → 0014 (shareable per-day routes) → 0015 (corrects 0014's role-split claim; management controls are unconditional)
- **Data modeling:** 0005 (client-trainer FK), 0006 (notification channels) stand alone
- **Hosting:** 0002 stands alone
