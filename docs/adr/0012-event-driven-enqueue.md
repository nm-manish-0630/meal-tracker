# ADR-012: Event-Driven Enqueue — Replacing the Hourly Catch-Up Scan

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish · Supersedes ADR-011's mechanism (not its decisions)

## Context

ADR-011's catch-up scan runs every hourly tick, re-reading up to 7 days of meals and diffing each meal's current photos against what `photo_progress` already recorded, to infer what's new. That inference is solving a problem the system doesn't actually have: NestJS learns about a new photo at exactly one moment — `POST /meals/confirm-upload` — since photos upload directly to R2 and bypass the backend entirely (ADR-007). A periodic scan reconstructs, after the fact and at a coarse hourly grain, information the system already had the instant the upload was confirmed.

## Decision

Move enqueue into `POST /meals/confirm-upload` itself. Every confirmed photo, for a meal dated within the 7-day catch-up window (ADR-011), immediately upserts a `digest_deliveries` row per trainer in the client's group and appends itself to that row's `photo_progress` — reusing `slack_message_ts` if the meal already has one, reopening with a fresh attempt budget if the row was previously `sent`, exactly as ADR-011 specified. This entirely replaces the hourly scan. As a safety net against a missed or failed enqueue, the same hourly job also runs a cheap reconciliation sweep — the same idea as ADR-009's orphaned-R2-object cleanup, applied to digest delivery instead of storage.

## Schema — simplifies on top of ADR-010/ADR-011

```sql
ALTER TABLE digest_deliveries
  DROP COLUMN digest_run_id,      -- no longer needed: eligibility is computed, not assigned at generation time
  DROP COLUMN delivery_kind,      -- derived at query time (meal_date = today ⇒ same-day, else catch-up) instead of stored
  ADD COLUMN meal_date DATE NOT NULL;  -- denormalized from meals, so eligibility never needs a join

-- digest_runs keeps exactly two jobs now: marking when today's send window opened,
-- and recording when today's own deliveries are all terminal. It no longer owns any
-- digest_deliveries rows via foreign key.
-- (digest_runs table itself, from ADR-010, is otherwise unchanged)
```

Once every delivery is created by the same enqueue path regardless of whether its meal is today's or 7 days old, there's nothing left for a stored `delivery_kind` or a generation-time FK to do — both were bookkeeping for a bulk-generation step that no longer exists. `meal_date` alone is enough to compute eligibility at drain time.

## Mechanism

**Enqueue, inside `POST /meals/confirm-upload`, after writing the photo row:**

```sql
if meal.meal_date < today - 7 days: return   -- outside the window (ADR-011); dashboard-only

for each trainer in meal.client.trainer_group:
  INSERT digest_deliveries (meal_id, meal_date=meal.meal_date, trainer_id,
                             status='pending', photo_progress=[{photo_id, status:'pending'}])
  ON CONFLICT (meal_id, trainer_id) DO UPDATE
    SET photo_progress = digest_deliveries.photo_progress || jsonb_build_array({photo_id, status:'pending'}),
        status = 'pending',
        attempt_count = CASE WHEN digest_deliveries.status = 'sent' THEN 0
                              ELSE digest_deliveries.attempt_count END,
        attempt_log = digest_deliveries.attempt_log || jsonb_build_array({at: now(), stage: 'enqueued'})
```

The whole thing is one atomic `INSERT ... ON CONFLICT DO UPDATE` rather than a read-modify-write in application code. This matters: a client can have up to 5 photos for one meal uploading concurrently (System Design's "Upload Concurrency" note already caps this at 2-3 parallel), each hitting `confirm-upload` independently and each needing to append to the _same_ delivery row's `photo_progress`. A naive "read the row, modify the JSON in application code, write it back" would drop concurrent appends under a race; a single atomic `UPDATE ... SET photo_progress = photo_progress || ...` does not, because Postgres serializes concurrent updates to the same row.

**Drain eligibility (replaces ADR-010's `digest_run_id`-scoped query):**

```sql
SELECT * FROM digest_deliveries d
WHERE d.status = 'pending' AND d.attempt_count < 4
AND (
  d.meal_date < CURRENT_DATE   -- catch-up: eligible as soon as enqueued, no window to wait for
  OR (d.meal_date = CURRENT_DATE AND EXISTS (
        SELECT 1 FROM digest_runs r WHERE r.run_date = CURRENT_DATE AND r.window_opened_at IS NOT NULL
      ))
)
```

A same-day meal's photos can be enqueued at 9am but still won't be picked up until `digest_time` has actually passed — the gate just moved from "was this row even generated yet" to "is this row eligible yet," which is a cheaper and more direct question. A backdated meal has no such gate: it's already in the past, so there's nothing to wait for.

**Reconciliation sweep (safety net, same hourly job, same cadence as ADR-009's R2 cleanup):**

```sql
orphaned = SELECT p.id, p.meal_id FROM photos p JOIN meals m ON m.id = p.meal_id
           WHERE m.meal_date >= CURRENT_DATE - INTERVAL '7 days'
             AND NOT EXISTS (
               SELECT 1 FROM digest_deliveries d
               WHERE d.meal_id = p.meal_id AND d.photo_progress @> jsonb_build_array({photo_id: p.id})
             )
for each orphaned photo: run the same enqueue logic as confirm-upload, tagging the
  attempt_log entry "stage: reconciliation-enqueue" instead of "enqueued" so a pattern
  of reconciliation catches (rather than direct enqueues) is visible as a signal that
  something in confirm-upload's enqueue path is failing, not just normal operation
```

## Alternatives Considered

| Option                                                                           | Pros                                                                                                                                                                                                                                                                                                                | Cons                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep ADR-011's hourly scan-and-diff exactly as designed                          | Already specified; no change needed                                                                                                                                                                                                                                                                                 | Solves a detection problem the system doesn't need to solve — the event already exists at confirm-upload; the diff logic is the most complex part of ADR-011 for no benefit over just knowing                                                                                 |
| Event-driven enqueue with no backup sweep                                        | Simplest possible version of this idea                                                                                                                                                                                                                                                                              | A silent bug or transient failure in confirm-upload's enqueue step (distinct from the photo-row write itself) would leave a photo permanently undelivered with nothing to ever notice — the same failure mode ADR-009 exists to prevent for R2 objects, left unaddressed here |
| **Event-driven enqueue (primary) + cheap reconciliation sweep (backup), chosen** | Removes the scan-and-diff complexity from the hot hourly path; unifies same-day and catch-up meals into one enqueue path instead of two (ADR-011's Step 0 + Step -1 collapse into one); immediate detection (no up-to-an-hour lag); the sweep is the same pattern already established by ADR-009, not a new concept | Enqueue logic now runs inside a client-facing request path rather than being isolated to the cron job — mitigated by keeping it a single atomic statement so it can't meaningfully slow down or fail the upload confirmation itself                                           |

## Consequences

- ADR-011's Step -1 (hourly scan) and ADR-010's Step 0 (bulk generation when today's window opens) are both removed — every delivery, same-day or catch-up, now originates from the same single enqueue path in `confirm-upload`, plus the reconciliation sweep as fallback
- `digest_deliveries.digest_run_id` and `.delivery_kind` are dropped; `meal_date` is added instead, and "is this a same-day or catch-up delivery" becomes a query-time comparison against `CURRENT_DATE` rather than a stored, potentially-stale label
- The drain step (ADR-010's Step 1) is otherwise unchanged: same 4-attempt cap, same idempotent skip-what's-already-succeeded logic, same `failed_permanent` + distinct Sentry alert on exhaustion, same append-only `attempt_log`
- Photo _reassignment_ to a different meal is not a feature the app has — there's no edit flow that moves a photo between meals, so this isn't an open question or a gap in scope, just a case that doesn't arise. Only newly-confirmed photos ever enqueue
- **Later amended:** the drain-eligibility query above still let catch-up rows post the moment they were enqueued, independent of `digest_time` — ADR-013 removes that exemption. Every delivery, same-day or catch-up, now waits for the same daily window, and posts as part of one consolidated message per trainer rather than its own separate message. The enqueue mechanism above (event-driven, inside `confirm-upload`, plus the reconciliation sweep) is unchanged — only when a claimed delivery becomes eligible to actually post changes. See ADR-013
