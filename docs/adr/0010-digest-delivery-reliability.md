# ADR-010: Digest Delivery Reliability — Idempotent, Retryable Slack Posting

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish · Refines ADR-003 and ADR-008

## Context

ADR-008 sends one Slack text message per meal, with up to 5 photos threaded underneath — each photo requiring an R2 download plus three separate Slack API calls (`getUploadURLExternal`, a raw POST, `completeUploadExternal`). None of this had defined behavior for partial failure: a dropped R2 download, a Slack rate limit mid-thread, or the job crashing between two clients.

The deeper problem was structural. ADR-003's `app_settings.last_sent_date` is a single flag for the entire day, set once after the whole hourly run finishes looping over every trainer group. If any single delivery failed partway — one bad Slack API call for one client — the run would still reach the end of the loop and mark `last_sent_date = today`, permanently skipping the failed delivery for the rest of that day. There was no retry, no per-delivery state, and no alert distinct from Sentry's cron monitoring, which only confirms the endpoint executed — not that every message and photo actually reached Slack.

## Decision

Replace `app_settings.last_sent_date` with a two-table delivery queue: `digest_runs` (one row per calendar day) and `digest_deliveries` (one row per meal × trainer — the actual unit that gets a Slack message). Each hourly cron tick drains whatever is still `pending` in today's queue, retrying only what failed, skipping only what already succeeded, up to **4 total attempts per delivery (1 initial + 3 retries)** before marking it `failed_permanent` and raising a distinct Sentry alert.

## Schema

```sql
CREATE TABLE digest_runs (
  id UUID PRIMARY KEY,
  run_date DATE NOT NULL UNIQUE,             -- one row per calendar day
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  window_opened_at TIMESTAMP,                -- when deliveries were generated
  completed_at TIMESTAMP,                    -- set once every delivery is terminal
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE digest_deliveries (
  id UUID PRIMARY KEY,
  digest_run_id UUID NOT NULL REFERENCES digest_runs(id),
  meal_id UUID NOT NULL REFERENCES meals(id),
  trainer_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending | sent | failed_permanent
  slack_channel_id VARCHAR,
  slack_message_ts VARCHAR,                  -- set once chat.postMessage succeeds
  photo_progress JSONB NOT NULL DEFAULT '[]',-- [{photo_id, status, slack_file_id, attempts}]
  attempt_count INT NOT NULL DEFAULT 0,
  attempt_log JSONB NOT NULL DEFAULT '[]',   -- append-only: [{attempt, at, stage, error}, ...]
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (meal_id, trainer_id)               -- idempotency guard at the DB level
);
```

`app_settings` keeps `digest_time` and `digest_time_timezone` (still used to decide when to open today's window) but drops `last_sent_date` entirely — `digest_runs.run_date` now answers "has today's window opened" and `digest_deliveries` answers "is there anything left to do."

**Later amended:** ADR-011 made `digest_run_id` nullable and added `delivery_kind` for catch-up deliveries; ADR-012 then dropped both in favor of a denormalized `meal_date` column once generation moved to an event-driven enqueue. Shown here as originally decided; see ADR-012 for the current schema.

## Failure visibility for debugging and retrospecting

A single `last_error` field that gets overwritten on every retry would destroy exactly the information a post-mortem needs — whether attempt 2 failed the same way as attempt 4, whether it was always the same photo, whether the failure moved between stages. Instead, `attempt_log` is append-only: every attempt, whether it fails or succeeds, adds one entry — `{ attempt: 2, at: "2026-09-16T21:03:00Z", stage: "photo:3/download", error: "R2 request timeout after 8s" }` — so a `failed_permanent` row retains the complete story of everything that was tried, in order, even long after the fact.

- This lives in Neon, not just Sentry — Sentry's free tier is 5,000 events/month with its own retention window, so the durable record for "what actually happened to this delivery over its lifetime" is the database row, queryable indefinitely, independent of Sentry's event retention or quota
- The Sentry alert raised on `failed_permanent` (see Consequences) includes the full `attempt_log` as event context, so the first alert already has the whole history attached — no need to cross-reference the database just to triage
- Because entries are tagged by stage (message post vs. a specific photo's download/getUploadURL/POST/complete step), a pattern across many failed deliveries — e.g. every failure landing on the same photo's R2 download — points at a systemic cause (a bad object, a CORS/permissions issue) rather than random flakiness, which a single overwritten error string could never reveal
- The Runbook adds a retrospective query against `attempt_log` for exactly this kind of review

## How idempotency actually holds, per step

- **Generating the queue:** The first hourly tick past `digest_time` each day inserts one `digest_deliveries` row per (meal, trainer) for that day's meals, once. The `UNIQUE (meal_id, trainer_id)` constraint plus `ON CONFLICT DO NOTHING` means even if this step accidentally ran twice, it's a no-op the second time — no duplicate rows, no duplicate sends. A meal logged after today's window has already opened is not inserted by this step — see ADR-011 for the separate, bounded mechanism that catches it instead of leaving it dashboard-only forever.
- **The text message:** Checked via `slack_message_ts IS NULL` before calling `chat.postMessage`. Once Slack returns a `ts`, it's persisted immediately, before any photo work starts. A retry with `slack_message_ts` already set skips straight to photos.
- **Each photo:** Tracked independently in `photo_progress`. A retry only touches photos still `pending`/`failed` in that JSON array — photos already marked `uploaded` (with their `slack_file_id` recorded) are never re-uploaded, so a partial failure (2 of 5 photos posted) never produces duplicates on retry, only the missing 3.
- **R2 availability on retry:** A retried photo re-downloads from R2. Since a confirmed photo always has a `photos` row, ADR-009's reconciliation job never targets it (that job only deletes R2 objects with *no* database row) — so the object is guaranteed to still be there no matter how many hours a delivery has been retrying.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| In-process retry with backoff (retry immediately inside one job run) | Resolves transient blips (a single dropped connection) within seconds, no waiting for the next hourly tick | Vercel functions have an execution time ceiling — looping with backoff inside one invocation risks the function itself timing out on a genuinely bad run; doesn't help at all if the failure is a sustained outage (e.g. Slack down for an hour) |
| Keep one global `last_sent_date`, just don't set it until every group succeeds | Minimal schema change | Doesn't fix the actual problem — one stuck client would block `last_sent_date` forever, silently preventing every *other* client's digest from ever being marked sent, and still gives no per-delivery retry or alerting |
| Unlimited retries until success | Never permanently gives up on a real message | A systemic failure (revoked Slack token, deleted channel) would retry forever every hour, indefinitely, without ever surfacing as a distinct problem — silent forever-pending is worse than a bounded, alerted failure |
| **Durable per-delivery queue, 4 attempts max, drained by the existing hourly cron (chosen)** | No new infrastructure — reuses the hourly tick that already exists; bounded and observable (permanent failures alert distinctly); idempotent at message, photo, and queue-generation level; a stuck client never blocks any other client | Two new tables and materially more logic in the digest endpoint; a delivery that fails all 4 attempts is a real, visible gap for that trainer that day — not a nothing outcome |

## Consequences

- "3 retries max" (4 attempts total) is enforced durably via `attempt_count` on the row — spread across however many hourly ticks it takes, not looped inside one invocation
- A delivery reaching `failed_permanent` raises its own Sentry error (with client/meal/trainer/photo context), separate from the existing cron check-in — closes the gap where a cron monitor showing "green" could still hide a silently-dropped message
- The underlying meal/photo data is never at risk here — Client and Trainer Dashboard views (Features 3 & 4) read directly from `meals`/`photos` and are unaffected by a Slack delivery failure; only the Slack notification itself can be lost, not the data
- A known, accepted residual risk: if the process crashes in the exact window after Slack confirms `chat.postMessage` but before `slack_message_ts` is persisted, a retry won't know the message already exists and will post a second header for that meal. Given this app's 2-3 user scale, a rare duplicate header is judged acceptable rather than solving exactly-once semantics Slack's API doesn't natively support (no idempotency key on `chat.postMessage`)
- Recovering from a `failed_permanent` delivery (e.g. after fixing a revoked bot token) is a manual operation — resetting `status` and `attempt_count` directly in Neon — rather than new Admin Dashboard scope; see the Runbook
- Supersedes the `last_sent_date` mechanism described in ADR-003; that ADR's Consequences section is amended to point here
- **Amendment — burst/rate-limit sizing considered, no code change made:** the photo-drain loop calls `files.getUploadURLExternal` and `files.completeUploadExternal` (Slack's Tier 4, roughly 100+ requests/minute) once per photo, strictly sequentially, with no explicit pacing between calls. At today's 2-3 users this is nowhere close to that limit. At the System Design's own stated growth ceiling (~10 clients / 3 trainers), a single trainer's worst case — several days of catch-up meals all claimed into one run — could plausibly approach it; `chat.postMessage`'s own ~1 message/second per-channel limit is a non-issue by comparison, since ADR-013 already consolidated delivery to one message per trainer per day. A 429 here is not a new failure mode: it's absorbed by the exact same attempt/retry mechanism as any other failed call above — `attempt_count` increments and the delivery is picked up on the next hourly tick. Deliberately not adding in-run `Retry-After` handling or explicit call pacing for this: the existing retry queue already recovers correctly, just up to an hour slower than a same-run retry would, for one cause among several this ADR already treats identically. Revisit only if `attempt_log` entries actually start showing rate-limit errors at real usage — see the Runbook's retrospective query
