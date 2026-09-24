# Meal Tracker — Runbook

Deployment, operations, and "how do I..." reference.

## 1. Accounts & Prerequisites

Six free accounts, all under the $0/month constraint (ADR-002):

| Service    | Used for                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| Vercel     | Frontend (Vue static) + backend (NestJS serverless functions)               |
| Neon       | PostgreSQL — metadata only, no photo bytes                                  |
| Cloudflare | R2 bucket — photo storage                                                   |
| Slack      | A Slack app with a bot token, installed in the workspace the trainer(s) use |
| GitHub     | Repo + Actions (hourly digest trigger, CI)                                  |
| Sentry     | Error tracking (frontend + backend) + cron monitoring on the digest job     |

## 2. Environment Variables & Secrets

Live in Vercel's environment variable store, scoped to Production (and separately to Preview/Development — see Local Development below). GitHub Actions secrets are separate, stored in the repo's Actions settings.

| Variable                                    | Where                 | Purpose                                                                                            |
| ------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Vercel                | Neon Postgres connection string                                                                    |
| `R2_ACCOUNT_ID`                             | Vercel                | Cloudflare account ID                                                                              |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Vercel                | R2 API credentials (S3-compatible), scoped to the bucket                                           |
| `R2_BUCKET_NAME`                            | Vercel                | Which bucket to use                                                                                |
| `SLACK_BOT_TOKEN`                           | Vercel                | Bot token for chat.postMessage + native file upload (ADR-008)                                      |
| `ADMIN_PASSWORD`                            | Vercel                | Shared password gating `/admin/*` (ADR-004)                                                        |
| `SENTRY_DSN_BACKEND`                        | Vercel                | NestJS Sentry project                                                                              |
| `VITE_SENTRY_DSN_FRONTEND`                  | Vercel (build-time)   | Vue Sentry project — DSNs are not secret by design, but still kept as an env var for easy rotation |
| `DIGEST_ENDPOINT_URL`                       | GitHub Actions secret | The deployed `/cron/send-daily-digest` URL the hourly workflow calls                               |

**Never commit these.** Use `.env.local` (gitignored) for local dev, matching the variable names above.

## 3. Initial Setup

1. **Neon:** create a project, copy the connection string into `DATABASE_URL`. Run the initial schema migration (see Database Migrations below) before first deploy.
2. **Cloudflare R2:** create a bucket, generate an API token scoped to it (Access Key ID + Secret). Configure CORS on the bucket to allow `PUT` from the app's domain — without this, direct browser uploads (ADR-007) will fail silently with a CORS error.
3. **Slack app:** create at api.slack.com, add scopes for `chat:write` and the file-upload scopes (`files:write`), install to the workspace, copy the bot token.
4. **Vercel:** connect the GitHub repo, add all env vars from the table above under Production (and Preview — see Local Development below).
5. **GitHub Actions:** add `DIGEST_ENDPOINT_URL` as a repo secret. The hourly workflow and the CI workflow (see GitHub CI below) both live in `.github/workflows/`.
6. **Sentry:** create one organization, two projects (Vue, NestJS). Copy each DSN into the corresponding env var. Create the one cron monitor for the digest job (see Observability below).

## 4. Database Migrations

The schema has changed repeatedly over the course of design (dropped `client_groups`, added `trainer_group_id`, added `app_settings`, changed `photos` from BYTEA to `r2_object_key`, dropped `app_settings.last_sent_date` and added `digest_runs`/`digest_deliveries` in its place, then dropped `digest_deliveries.digest_run_id` and `delivery_kind` again in favor of a denormalized `meal_date` once delivery generation moved to upload-time enqueue, then added `digest_messages` and moved `slack_message_ts`/`slack_channel_id` up onto it once delivery consolidated into one message per trainer per day...). Hand-running SQL against Neon directly works until a change is forgotten or applied out of order. Use a real migration tool from the start:

**Recommendation:** TypeORM migrations (pairs naturally with NestJS). Prisma Migrate is a fine alternative if the team ends up preferring Prisma's query layer — pick one, not both.

- Every schema change is a migration file, committed to the repo — the schema's history lives in git, not in memory
- Migrations run as a deploy step (or manually via CLI before a deploy) — never hand-edited directly in Neon's SQL console for anything beyond one-off debugging
- Local dev runs migrations against the dev branch (see below) before testing

## 5. Local Development

Never point local development at the real Neon database, real R2 bucket, or the real Slack workspace — a bug during testing shouldn't be able to page the actual trainer.

- **Database:** `docker compose up -d` (root `docker-compose.yml`) runs a local Postgres for day-to-day dev — no external account needed to start building. Switch `DATABASE_URL` to a Neon dev branch (instant branching, its own connection string) before deploying, or sooner if you want dev data to persist across machines
- **Photo storage:** a separate R2 bucket (e.g. `food-tracker-dev`), or at minimum a distinct key prefix in the same bucket
- **Slack:** a personal test workspace with its own Slack app + bot token — never the real trainer's workspace
- All of the above go in `.env.local` (see `.env.example` at the repo root for every variable), gitignored, mirroring the variable names in the Vercel env var table

## 6. Deploy Flow

- **Production:** push to `main` → Vercel auto-builds and deploys frontend + backend together.
- **Preview:** every branch/PR gets its own preview deployment automatically (Vercel default) — using the Preview-scoped env vars (dev database, dev R2 bucket), never production credentials.
- **Rollback:** Vercel keeps prior deployments; promote an earlier one from the dashboard if a deploy introduces a regression.

## 7. GitHub CI

Today, GitHub Actions only runs the hourly digest trigger. Nothing checks the code itself before it merges. Add a second, separate workflow:

```yaml
# .github/workflows/ci.yml
on: pull_request, push to main
jobs:
  - lint
  - type-check
  - test (unit tests for meal-time detection, digest timing logic, digest delivery idempotency, etc.)
```

Keep this fully separate from `.github/workflows/digest-cron.yml` (the hourly trigger) — different purpose, different trigger, no reason to couple them.

## 8. Observability (Sentry)

### Setup

- Install `@sentry/vue` in the frontend, `@sentry/node` in the NestJS backend — each reporting to its own Sentry project, sharing one 5,000-events/month pool (Sentry free "Developer" tier)
- Create **one** Sentry Cron Monitor for the digest job (the free tier includes exactly 1, and there's exactly one scheduled job)

### Digest cron check-in

The digest endpoint (`POST /cron/send-daily-digest`) should check in with Sentry at the start and end of every run — not just when it actually sends, but every hourly invocation, including the "not yet time" and "queue already drained" early returns. This is what closes the PRD's "must not miss the configured send time (monitored + alerts)" requirement (amended into ADR-003) — if an hourly check-in stops arriving, Sentry alerts.

### Failed-delivery alerts (ADR-010)

The cron check-in only confirms the endpoint ran — it says nothing about whether every message and photo actually reached Slack. A separate, distinct Sentry error is raised whenever a `digest_deliveries` row exhausts its 4 attempts and is marked `failed_permanent`, with the delivery's full `attempt_log` attached as event context (client, meal, trainer, which stage failed on which attempt). This is the signal to watch for actual delivery gaps — a green cron check-in and a `failed_permanent` alert are not mutually exclusive, and both matter.

### What this does and doesn't cover

Sentry answers "did anything throw an error," "did the digest job run on schedule," and now "did every individual message/photo actually get delivered." It does not give latency trends, request-rate dashboards, or cross-service correlation — that's Grafana/Prometheus territory, deliberately not adopted here (disproportionate to an app this size; see the ADRs discussion). Platform-native dashboards (Vercel, Neon, R2, GitHub Actions — see below) fill the "is the infrastructure itself healthy" gap without any new tooling.

## 9. Free-Tier Monitoring Checklist

Nothing here auto-alerts on its own (unlike the digest, which has Sentry cron monitoring) — these are dashboards worth a periodic manual glance, especially in the first few months.

| Service        | Limit                                    | Where to check                             |
| -------------- | ---------------------------------------- | ------------------------------------------ |
| Neon           | ~5GB storage                             | Neon console → project storage             |
| Cloudflare R2  | 10GB storage, 1M writes/mo, 10M reads/mo | Cloudflare dashboard → R2 → bucket metrics |
| GitHub Actions | 2,000 min/mo (private repo)              | Repo → Settings → Actions → Usage          |
| Sentry         | 5,000 events/mo (shared FE + BE)         | Sentry → Organization Settings → Usage     |

At this app's actual volume (2-3 users), none of these are expected to be hit — see the System Design's cost breakdown for the underlying math. This table exists so a future surprise has an obvious first place to check.

## 10. Backups & Recovery

Neon includes built-in point-in-time recovery (instant restore) on the free tier — sources differ on the exact retention window (reports range from 6 to 24 hours), so **verify the current figure in the Neon console** rather than relying on a number written here. Either way, it's enough to recover from a same-day bad migration or accidental delete, not a long-term backup strategy.

**Not covered by free-tier PITR:** recovering something deleted weeks ago, or a full disaster-recovery copy outside Neon entirely. If that ever matters, Neon also supports scheduled `pg_dump` exports (e.g., to R2) — not set up today, since the free-tier instant-restore window is judged sufficient for this app's actual risk level (small, infrequently-changing dataset, single operator).

R2 has no built-in point-in-time recovery — deleting an object is final. The reconciliation job (ADR-009) only deletes objects that are already orphaned (no DB row); it never touches objects that do have one, including one still being retried by a pending digest delivery (ADR-010).

## 11. Common Operations

### Did today's digest actually send?

Check the Sentry cron monitor's status first — it will show missed or failed check-ins directly. For the actual delivery state (not just "did the endpoint run"), check today's `digest_messages` — one row per trainer, the thing that actually reached Slack (ADR-013):

```sql
SELECT trainer_id, status AS message_status, slack_message_ts IS NOT NULL AS header_posted
FROM digest_messages
WHERE run_date = CURRENT_DATE;
```

Every trainer's row `sent` means today's digests are all fully delivered. For the per-meal breakdown behind a given trainer's message:

```sql
SELECT dd.status, count(*)
FROM digest_deliveries dd
JOIN digest_messages dm ON dm.id = dd.digest_message_id
WHERE dm.run_date = CURRENT_DATE AND dm.trainer_id = '<trainer_id>'
GROUP BY dd.status;
```

Any `failed_permanent` rows should already have raised a distinct Sentry alert (see Observability) — these queries are the same picture, queryable any time. Note `digest_deliveries.digest_run_id` no longer exists — it was dropped in ADR-012 (replaced by `meal_date`) and there is no `digest_message_id` to join on until ADR-013's Step 0.5 has claimed a row, so a brand-new, not-yet-claimed delivery won't show up in the second query yet — that's expected, not a bug.

### Retrospecting on a failed digest delivery

Every attempt against a delivery — success or failure — is appended to `attempt_log`, so the full history survives independent of Sentry's retention window:

```sql
SELECT meal_id, trainer_id,
       CASE WHEN meal_date = CURRENT_DATE THEN 'same-day' ELSE 'catchup' END AS kind,
       attempt_count, attempt_log
FROM digest_deliveries
WHERE status = 'failed_permanent'
ORDER BY last_attempt_at DESC;
```

Each `attempt_log` entry records which stage failed (message post, a specific photo's download/upload step, an "enqueued" marker from `confirm-upload`, or a "reconciliation-enqueue" marker from the ADR-012 safety sweep) and the error at that attempt. Several deliveries failing at the same stage (e.g. always "photo:*/download") points at a systemic cause — a bucket permissions change, an expired R2 token — rather than one-off flakiness worth ignoring. A run of `reconciliation-enqueue` entries is itself a signal worth investigating: it means the primary enqueue path inside `confirm-upload` is failing to fire, not just that Slack delivery is slow. A cluster of failures at the photo-upload stage carrying a 429 / `rate_limited` error is the specific signal ADR-010's burst-handling amendment says to watch for — it means the digest job's growth has actually reached Slack's Tier 4 file-upload limit, at which point in-run backoff (deliberately not built) is worth revisiting rather than continuing to absorb it as an hourly retry.

### Checking catch-up (late photo) delivery status

`meal_date` is what distinguishes a same-day delivery from a catch-up one (ADR-012) — same-day and catch-up now post on the same schedule (ADR-013), so this is purely a content classification, not a timing one:

```sql
SELECT
  CASE WHEN meal_date = CURRENT_DATE THEN 'same-day' ELSE 'catchup' END AS kind,
  status, count(*)
FROM digest_deliveries
WHERE meal_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 1, 2;
```

A meal older than 7 days that a client insists they uploaded photos for, but that never reached Slack, is expected behavior, not a bug — confirm the meal's date against the 7-day cutoff before treating it as a delivery failure. If a row for a recent meal is unexpectedly missing entirely (no `pending`, `sent`, or `failed_permanent` row at all), that means both `confirm-upload`'s enqueue _and_ the reconciliation sweep missed it — worth a closer look, since that shouldn't happen given the sweep runs every hourly tick. A row that's `pending` with `digest_message_id IS NULL` is just waiting for the next window-open sweep to claim it into a message (ADR-013) — not stuck, unless that's still true well after the window should have opened.

### Recover a permanently-failed digest delivery

Fix the underlying cause first (rotate the credential, check Slack app permissions, confirm the trainer's DM channel still exists) — resetting without fixing the cause just re-burns the same 4 attempts. Once fixed:

```sql
UPDATE digest_deliveries
SET status = 'pending', attempt_count = 0
WHERE id = '<delivery_id>';
```

The next hourly tick (or a manual trigger, below) picks it up fresh. This is a direct database operation rather than an Admin Dashboard action — acceptable given the single-trusted-operator model (ADR-004); not expected to be a frequent occurrence.

### Manually trigger the digest (for testing, or to retry sooner)

Call `POST /cron/send-daily-digest` directly — it's a public endpoint, same one GitHub Actions hits hourly. Useful for verifying a change, or for draining a just-recovered delivery without waiting for the next scheduled hourly tick.

### A free tier filled up

Check the table in section 9 for where to look. None of these have a paid-tier cliff that breaks the app outright (see each service's ADR/System Design entry) — worst case is a small metered cost (e.g., R2 above 10GB) rather than an outage.

### Rotate a secret (Slack token, R2 credentials, admin password)

Generate the new credential at the source (Slack app settings / Cloudflare API tokens / choose a new admin password), update the corresponding Vercel env var, redeploy. No code change needed for any of these — they're all read from environment variables, never hardcoded (ADR-004, ADR-007).
