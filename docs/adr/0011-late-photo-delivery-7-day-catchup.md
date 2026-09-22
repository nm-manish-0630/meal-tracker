# ADR-011: Late Photo Delivery — 7-Day Catch-Up Window

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish · Amends ADR-003 and ADR-010

## Context

PRD Feature 4 and the queue-generation logic in ADR-010 established a hard rule: a meal's `digest_deliveries` row is created exactly once, the first hourly tick after that day's `digest_time` — a meal or photo logged after that point never gets a Slack message, appearing only in the dashboards ("no retroactive resend"). That was deliberate: it kept queue generation simple and ruled out duplicate or stale header messages.

In practice, this makes the digest unreliable exactly when it matters most: a client who genuinely forgets to upload on the day itself — the PRD's own US-3 scenario — gets no Slack notification at all, silently, unless the trainer happens to open the dashboard. That's precisely the "photos scattered across messages, hard to batch review" pain point (PRD Target Users table) the digest exists to solve. A missed day quietly degrading to dashboard-only defeats the product's core promise for the single most likely failure mode.

## Decision

Add a rolling **7-day catch-up window**, scanned every hourly tick independent of whether today's digest window has opened. Any meal dated within the last 7 days that either (a) has no delivery row yet, or (b) has a row but gained new photos since it was created or last sent, gets queued. A brand-new late meal gets a normal delivery (header message + threaded photos). A meal that was already sent does **not** get a duplicate header — its existing `slack_message_ts` is reused, and only the new photos are threaded under it, with their own fresh 4-attempt budget. A meal or photo older than 7 days is never (re)queued — it stays dashboard-only, exactly as before this ADR.

## Not the same "7 days" as ADR-007

Worth being explicit about, since the number coincides: this is a **product policy** — a deliberate choice about how long "still counts as recent enough to notify on" should hold — not a technical constraint. ADR-007's 7-day figure was the S3/R2 presigned URL's protocol-level expiry, and ADR-008 already eliminated that entirely by switching to native Slack file upload (no expiry, ever). The two numbers are unrelated and happen to match; nothing here reintroduces any notion of expiry. The boundary is enforced purely in application logic — a `WHERE meal_date >= today - 7 days` clause — and could be changed independently of anything Slack- or R2-related.

## Schema changes (amends ADR-010)

```sql
ALTER TABLE digest_deliveries
  ALTER COLUMN digest_run_id DROP NOT NULL,        -- catch-up deliveries aren't tied to one day's run
  ADD COLUMN delivery_kind VARCHAR NOT NULL DEFAULT 'daily';  -- 'daily' | 'catchup'
```

`digest_run_id` stays required for `delivery_kind = 'daily'` (today's own meals, as ADR-010 defined) and is `NULL` for `'catchup'` rows, which stand alone rather than belonging to a single day's run. The draining step (ADR-010's Step 1) processes every `pending` row regardless of kind — the same idempotent message/photo logic applies unchanged either way.

## Mechanism — runs every hourly tick, unconditionally

```
window_start = today - 7 days  (per trainer group's own digest_timezone)
candidates = SELECT DISTINCT meal_id FROM meals
             WHERE meal_date >= window_start AND meal_date < today

for each candidate meal, for each trainer in its group:
  delivery = SELECT * FROM digest_deliveries WHERE meal_id=... AND trainer_id=...
  current_photo_ids = SELECT id FROM photos WHERE meal_id = candidate.id

  if delivery does not exist:
    INSERT digest_deliveries (digest_run_id=NULL, delivery_kind='catchup',
                               meal_id, trainer_id, status='pending',
                               photo_progress=[current_photo_ids as pending])
    ON CONFLICT (meal_id, trainer_id) DO NOTHING   -- same idempotency guard as ADR-010

  else:
    new_photo_ids = current_photo_ids MINUS keys(delivery.photo_progress)
    if new_photo_ids is non-empty:
      append new_photo_ids to delivery.photo_progress as 'pending'
      append attempt_log entry: "reopened: N new photo(s) added"
      if delivery.status = 'sent':
        delivery.status = 'pending'
        delivery.attempt_count = 0   -- fresh 4-attempt budget for the new work only
```

`attempt_count` resets on reopen because it's a new, bounded unit of work with its own budget — but `attempt_log` is never reset (ADR-010), so the full lifetime history, including every reopening, stays visible for retrospecting. Step 1 (the drain loop) then runs exactly as ADR-010 describes: skip `chat.postMessage` if `slack_message_ts` is already set, skip any photo already marked `uploaded`.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| Keep "no retroactive resend" absolute — rely on the trainer checking the dashboard | Zero new complexity | Doesn't solve the actual problem — this is exactly the reported scenario (a forgotten upload), and dashboard-only for a missed day gives the trainer no reason to think to look |
| Resend the entire message (new header + every photo, including already-uploaded ones) whenever a meal changes within 7 days | Simplest logic — no thread-reuse complexity | Produces a duplicate header and duplicate photos every time — exactly the double-posting ADR-010 was built to prevent; three copies of the same meal is worse for the trainer than the current dashboard-only gap |
| Unlimited catch-up window (no cutoff) | Never silently drops a late upload, however old | Unbounded — a client backfilling a 6-month-old backlog would flood the trainer's Slack with dozens of stale "daily" digests, defeating the digest's purpose as a timely summary; also complicates day-boundary reasoning for very old dates |
| **7-day rolling catch-up, reusing the existing thread for new photos, no duplicate header (chosen)** | Solves the actual reported problem; no duplicate messages; a bounded, cheap scan (7 days of meals, not the whole table); builds directly on ADR-010's idempotency machinery instead of replacing it | Still a real, unchanged gap for anything older than 7 days (dashboard-only, as always); a meal gaining photos daily reopens repeatedly, each with its own budget — bounded in practice by the existing 5-photos-per-meal cap |

## Consequences

- "No retroactive resend" is narrowed, not removed: it now guarantees no duplicate header message, not no late content at all. The PRD's Feature 4, US-3, and US-5 are updated to state this narrower guarantee explicitly
- The late-meal scan is a bounded query (7 days of meals) run every hourly tick regardless of `digest_time` — cheap at this app's volume, piggybacking on the same endpoint as the daily send and R2 reconciliation (ADR-009), rather than adding a new trigger
- A delivery's `attempt_count` now has "fresh budget per reopening" semantics instead of one lifetime cap; `attempt_log` remains the complete, non-resetting history, so a retrospective review still sees every reopening and every attempt against it
- Meal-type edits and deletions remain entirely out of scope here — unchanged from the original PRD, they stay dashboard-only. Only *new photos* on a meal within the 7-day window trigger delivery
- This ADR's "7 days" and ADR-007's now-eliminated presigned-URL expiry are unrelated; nothing here reintroduces expiry semantics of any kind
- **Amendment:** the hourly scan-and-diff *mechanism* described above (Step -1, comparing current photos against `photo_progress` every tick) is superseded by ADR-012, which moves enqueue to the moment of upload instead of inferring it later. The *decisions* made here — the 7-day window, no duplicate header, fresh attempt budget on reopen — are unchanged and still govern behavior
- **Later amended again:** this ADR's "catch-up delivers as soon as it's enqueued, no window to wait for" behavior (carried into ADR-012's drain query) is reversed by ADR-013 — a trainer was ending up with Slack messages scattered through the day instead of one daily digest. Catch-up deliveries now wait for the same `digest_time` gate as same-day ones, consolidated into a single message per trainer per day. The 7-day window itself, and "no duplicate header," are unchanged — see ADR-013
