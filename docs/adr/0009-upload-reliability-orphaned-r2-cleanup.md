# ADR-009: Upload Reliability — Orphaned R2 Object Cleanup

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

The R2 upload flow (ADR-007) is two separate steps: the browser PUTs bytes to R2, then separately calls `/meals/confirm-upload` to write the `photos` row. If the confirm call never arrives — the client crashes, closes the tab, or loses connection between the two steps — R2 ends up holding a photo with no database row pointing at it. This is invisible to the app (nothing queries for it), still counts against the 10GB free tier, and the 1-year retention cleanup won't touch it either, since that job works off `photos` rows, not a raw R2 listing.

## Decision

Add a periodic reconciliation step to the existing hourly digest cron: list R2 objects, cross-reference against `photos.r2_object_key`, and delete any R2-only object older than a 24-hour grace period (to avoid deleting an upload that's still legitimately in flight).

## Alternatives Considered

| Option                                             | Pros                                                                                                                                                                                             | Cons                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Client-side retry with backoff on the confirm call | Catches the common case (transient network blip) with no server-side work                                                                                                                        | Doesn't help if the client crashes or closes before confirming at all — leaves the gap open                                      |
| Do nothing                                         | No extra code                                                                                                                                                                                    | Silent, unbounded storage leak against a free-tier quota — unacceptable for a "final product" with no one watching it day to day |
| **Periodic reconciliation job (chosen)**           | Closes the gap regardless of cause; piggybacks on the cron job that already runs hourly, so no new infrastructure; R2 list-objects calls are Class B operations, effectively free at this volume | One more thing the digest endpoint does each run; needs the 24h grace window to avoid racing an in-flight upload                 |

## Consequences

- The hourly cron endpoint now does two jobs, not one — send the digest (if due) and reconcile orphaned objects (every run). Kept as one endpoint rather than two separate cron triggers, since both are cheap and hourly is already the cadence
- Client-side retry-with-backoff on confirm is still worth having as a first line of defense — it just isn't sufficient on its own, so it's a complement to this job, not a replacement
- Frontend Sentry (see the Runbook) helps diagnose _why_ confirms fail when they do, which this job doesn't explain — the two are complementary: Sentry surfaces the cause, reconciliation cleans up the result
- This job only ever deletes R2 objects with _no_ matching `photos` row. A confirmed photo — including one whose digest delivery is still retrying under ADR-010 — always has a row, so it is never a candidate for deletion here, no matter how many hours a delivery retry has been pending
