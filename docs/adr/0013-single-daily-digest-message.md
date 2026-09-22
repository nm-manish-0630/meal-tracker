# ADR-013: Single Daily Digest Message — Consolidating Same-Day and Catch-Up Delivery

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** Manish · Amends ADR-010 (schema), ADR-011 (catch-up timing), ADR-012 (drain eligibility)

## Context

ADR-011 and ADR-012 deliberately let a catch-up (backdated) meal's delivery fire the moment it was enqueued — "already in the past, so there's nothing to wait for," as ADR-012 put it. Combined with same-day deliveries firing per-meal as soon as `digest_time` passes, the trainer ends up receiving one Slack message *per meal*, arriving throughout the day as clients upload — up to 4 messages for today's meals plus however many catch-up messages land whenever backdated photos get confirmed. That's the opposite of what a daily digest is for: instead of one end-of-day summary, the trainer gets interrupted repeatedly, and a late catch-up upload can trigger a Slack ping in the middle of their day, unrelated to today's own digest_time.

What's actually wanted: exactly one Slack message per trainer per day, sent only at the configured `digest_time`, reporting everything relevant — today's meals and any newly-caught-up meals from up to 7 days back — in one shot, grouped by date:

```
Hi Trainer_Name,

Meal photos for today:
Breakfast: 5 photos
Lunch: 5 photos
Dinner: 5 photos
Snack: 5 photos

Remaining meal photos for yesterday (16th September):
Breakfast: 3 photos
Lunch: 3 photos
Dinner: 3 photos
Snack: 3 photos
```

Multiple distinct catch-up dates within the 7-day window each get their own "Remaining meal photos for `<date>`" block, most recent first — not collapsed into one section and not narrowed to just "yesterday."

## Decision

Two changes, together: **(1)** catch-up deliveries lose their early-eligibility exemption — every delivery, same-day or catch-up, now waits for the same `digest_time` window before anything posts. **(2)** the unit of Slack delivery moves from "one message per meal" to **one message per trainer per day**. A new `digest_messages` table holds that single header per (trainer, run_date); `digest_deliveries` rows (still one per meal, unchanged) attach to it via a new `digest_message_id` FK instead of each carrying its own `slack_message_ts`. The header text is composed once, the first tick after the window opens, from whichever deliveries are still unclaimed at that moment — grouped into a "today" section plus one "remaining meal photos for `<date>`" section per distinct earlier date — and every meal's photos are threaded underneath that one message, same idempotent thread-reuse logic as ADR-010, just one level higher up.

## Schema (amends ADR-010/ADR-012)

```sql
-- NEW: one row per trainer per day — the single message every that trainer's
-- meals (same-day and catch-up alike) get consolidated into and threaded under
CREATE TABLE digest_messages (
  id UUID PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES users(id),
  run_date DATE NOT NULL,                      -- the day this digest fires, i.e. today
  status VARCHAR NOT NULL DEFAULT 'pending',   -- pending | sent | failed_permanent
  slack_channel_id VARCHAR,
  slack_message_ts VARCHAR,
  attempt_count INT NOT NULL DEFAULT 0,        -- retry budget for POSTING THE HEADER itself
  attempt_log JSONB NOT NULL DEFAULT '[]',
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (trainer_id, run_date)
);

-- digest_deliveries: drops its own slack_message_ts/slack_channel_id (moved up to
-- digest_messages, since the message is now shared across meals); gains digest_message_id
ALTER TABLE digest_deliveries
  DROP COLUMN slack_message_ts,
  DROP COLUMN slack_channel_id,
  ADD COLUMN digest_message_id UUID REFERENCES digest_messages(id);
-- meal_id, meal_date, trainer_id, status, photo_progress, attempt_count, attempt_log,
-- last_attempt_at, and UNIQUE(meal_id, trainer_id) are all otherwise unchanged from ADR-012
```

`digest_message_id`, once set on a delivery, is permanent — it is that meal's thread-home for as long as the meal exists. A meal that already has a `sent` delivery and later gains a new photo (ADR-011's "reopen") keeps posting into that same original message's thread, even if that message is from days ago — it does *not* get reassigned to today's new message. Only deliveries that have *never* been claimed by any message (`digest_message_id IS NULL`) are eligible to be grouped into whichever header is being composed right now. This is what makes "no duplicate header" hold at the new, coarser granularity: a header is composed once per trainer per day, for whatever's unclaimed at that moment, and reopened meals never re-enter that pool.

## Mechanism

**Step 0.5 — compose & post each trainer's header, once (new step, between ADR-010's Step 0 and Step 1):**

```
-- only runs once today's window has opened (Step 0, unchanged)
trainers = SELECT DISTINCT trainer_id FROM digest_deliveries
           WHERE status = 'pending' AND digest_message_id IS NULL

for each trainer:
  msg = INSERT INTO digest_messages (trainer_id, run_date) VALUES (trainer, CURRENT_DATE)
        ON CONFLICT (trainer_id, run_date) DO NOTHING   -- idempotent: reuse today's row if it exists
        RETURNING * / or SELECT it if the insert was a no-op

  if msg.slack_message_ts IS NULL AND msg.attempt_count < 4:
    claimed = SELECT * FROM digest_deliveries
              WHERE trainer_id = trainer AND status = 'pending' AND digest_message_id IS NULL
    group claimed by meal_date → "today" bucket + one bucket per distinct earlier date
    text = compose("Meal photos for today:\n" + one line per meal_type with a photo,
                    then, most-recent-date-first, "\nRemaining meal photos for {date}:\n" + same per-meal_type lines)
    msg.attempt_count += 1; append attempt_log entry (start)
    ts = chat.postMessage(text)
    on success: UPDATE digest_messages SET slack_message_ts = ts WHERE id = msg.id
                UPDATE digest_deliveries SET digest_message_id = msg.id WHERE id IN (claimed)
    on failure: append attempt_log entry (error) — msg stays without slack_message_ts;
                claimed rows stay unclaimed too, so the identical set (plus anything newly
                enqueued since) gets regrouped and retried next tick, up to 4 attempts
```

The cutoff for "what's in today's message" is the successful post, not the first attempt — if the header itself needs a retry, anything enqueued in the meantime still gets swept into the same still-unsent message rather than waiting an extra day. Once posted, nothing more is ever added to the header text itself; new same-day uploads after that point are simply unclaimed and wait for tomorrow's message.

**Step 1 — drain (thread photos under each trainer's already-posted message):**

```sql
SELECT d.* FROM digest_deliveries d
JOIN digest_messages m ON d.digest_message_id = m.id
WHERE d.status = 'pending' AND d.attempt_count < 4 AND m.slack_message_ts IS NOT NULL
```

Replaces ADR-012's drain query, which had a separate "catch-up is eligible immediately" branch — that branch is gone. Both same-day and catch-up rows now reach this query the same way: only once claimed by a posted message. The per-delivery, per-photo upload loop itself — skip whatever's already `'uploaded'`, cap at 4 attempts, `failed_permanent` + Sentry alert on exhaustion, append-only `attempt_log` — is entirely unchanged from ADR-010, just threaded under `m.slack_message_ts` instead of a per-delivery one.

**Step 2 — close out (unchanged in spirit, now at message level):**

```sql
UPDATE digest_messages SET status = 'sent'
WHERE run_date = CURRENT_DATE AND status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM digest_deliveries WHERE digest_message_id = digest_messages.id AND status = 'pending')
```

A trainer with nothing pending — no new same-day meals, no newly-caught-up ones — gets no `digest_messages` row and no Slack message that day at all, same as before. ADR-012's reconciliation sweep (missed-enqueue safety net) is otherwise unchanged: anything it catches just enters the normal unclaimed pool and gets swept up by whichever day's Step 0.5 runs next, with no special-casing needed anymore now that catch-up has no separate immediate path.

**Multi-client note:** at today's 1-client-per-trainer-group scale, grouping claimed deliveries by (date, meal_type) is unambiguous. A trainer group with more than one client would need a client name in each line too — grouping by (client, date, meal_type) instead — which the schema already supports (every delivery is traceable to its client via `meal_id`) but the header-composition logic above doesn't yet implement, since there's nothing to test it against right now.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| Keep catch-up's immediate-delivery exemption (ADR-011/ADR-012 as-is) | Already built; fastest possible catch-up notification | Exactly the scattered-notifications behavior this ADR exists to fix — a trainer can get pinged mid-day for a photo uploaded a week late |
| Keep one message per meal, just gate catch-up on the window too | Smaller change — no new table, no digest_message_id | Still leaves the trainer with N separate Slack messages arriving together at digest_time instead of one; doesn't address the actual ask of a single consolidated daily message |
| Edit the already-sent header text as later catch-up items trickle in | Could theoretically keep one message "live" and always current | Slack message editing is a fourth API call shape to make idempotent on top of post + upload-url + complete-upload; "when do we stop editing and call it final" adds its own bookkeeping for no real benefit over just drawing a hard line at window-open time |
| **Uniform window gate for all deliveries + one message per trainer per day, chosen** | Exactly one Slack ping per trainer per day (barring retries, which only add to an existing thread, never a new message); the "claimed at window-open, anything later waits for tomorrow" rule is a single clean cutoff, no editing or re-composition needed; reopened meals keep threading into their original message with no special-casing | One more table and one more join in the drain query; a header that needs 4 failed attempts to post blocks every meal under it from threading until it succeeds — mitigated by this being the same bounded 4-attempt/hourly-tick budget already used everywhere else in the design |

## Consequences

- A trainer receives exactly one Slack message per day, whenever there's anything to report — not one message per meal, and not scattered across the day for catch-up uploads. Retries only add photos to that one message's existing thread; they never create a second message
- The "no duplicate header, fresh attempt budget on reopen" guarantee from ADR-011 still holds, just at the coarser granularity: a reopened meal's new photo threads into whichever message originally claimed it, even if that was days ago, rather than into today's message
- ADR-012's "catch-up eligible immediately" drain branch is removed entirely — every delivery now reaches Slack the same way, through the same uniform gate. The enqueue mechanism (event-driven, at `confirm-upload`, plus the reconciliation sweep) is completely unaffected; only the drain query and the message-level grouping change
- A trainer with zero new same-day or catch-up photos on a given day gets no `digest_messages` row and no Slack message — unchanged from before, just now true at the trainer level instead of the meal level
- Multi-client trainer groups are a known gap in the header-composition logic (not the schema) — see the Multi-client note above. Not a concern at the current 1-client scale, and easy to add without a schema change if it's ever needed
