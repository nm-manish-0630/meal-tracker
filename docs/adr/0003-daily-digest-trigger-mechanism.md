# ADR-003: Daily Digest Trigger Mechanism

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

The app needs to send exactly one Slack digest per day, at an admin-configurable time rather than a value hardcoded in code. NestJS supports internal scheduling via `@nestjs/schedule`, but this requires a persistent, always-running process — which Vercel serverless functions do not provide (they spin down after each request, per ADR-002) — so the trigger has to come from outside the app. Two further constraints shaped this: the $0/month cost target (ADR-002), and a correctness requirement that only became clear during design — a digest built from that day's meals can't be prepared before those meals exist.

## Decision

A stateless `POST /cron/send-daily-digest` endpoint, triggered by `GitHub Actions` **every hour**. Each run reads one global `app_settings` row (`digest_time`, `digest_time_timezone`); if the current time has reached the configured moment, it opens (or continues draining) that day's digest delivery queue for *every* trainer group at that same real-world moment. Each trainer group's own `digest_timezone` is still used to decide which meals count as "today" for that group — so content stays correct even though delivery timing is shared. See ADR-010 for how "today hasn't been sent yet" is now tracked per delivery rather than as one flag.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| NestJS internal cron (`@nestjs/schedule`) | Simple, self-contained, no external dependency | Doesn't work on Vercel serverless (no persistent process) |
| One fixed daily trigger, hardcoded in the workflow YAML | Minimal GitHub Actions minutes (~2 min/day); dead simple | Changing the send time means editing code and redeploying — exactly what "configurable" was meant to avoid |
| 15-minute polling, per-trainer-group send times | Each group could have a genuinely different real delivery moment | 96 runs/day (~2,880 min/month) exceeds the 2,000 free minutes/month on a *private* repo — would have forced the repo to be public just to stay free |
| Pre-scheduled Slack messages (`chat.scheduleMessage`), fired once early each day | Slack handles exact delivery timing natively; only one GitHub Actions run/day needed | **Breaks correctness:** Slack captures the message content at schedule time, not send time. Scheduling early enough to precede every group's chosen hour means scheduling before that day's meals have been logged — the digest would go out empty or stale |
| **Hourly check against one global setting (chosen)** | Exactly one send per day; content is always built at actual send time (no staleness); genuinely admin-configurable with no redeploy; 24 runs/day (~720 min/month) comfortably fits the free tier on a *private* repo | All trainer groups receive their digest at the same real-world moment rather than independently chosen times; ~1 hour delivery precision, not to-the-minute |

## Consequences

- Backend stays fully stateless and portable — the endpoint can be called by any scheduler in the future
- Digest logic is testable independently by calling the endpoint manually
- GitHub Actions minutes (~720/month) stay well within free tier even on a private repo — no public-repo requirement, unlike the rejected 15-minute-polling design
- Per-group `digest_timezone` is still meaningful and stored — it determines meal-day boundaries — even though it no longer drives a separate delivery time
- If genuinely independent per-group delivery times become a real need later, that's a deliberate future reconsideration (see PRD framing on scope), not something this design tries to anticipate now
- Relies on GitHub Actions' scheduling — should monitor for missed/delayed runs
- **Amendment:** this ADR originally left "should monitor" unimplemented — the PRD's "must not miss the configured send time (monitored + alerts)" requirement had no actual mechanism behind it. Closed via Sentry Cron Monitoring: the digest endpoint checks in with Sentry at the start and end of each run, and Sentry alerts if a check-in doesn't arrive when expected. See the Runbook for setup
- **Amendment 2:** the `app_settings.last_sent_date` mechanism originally described above — one global flag set after the entire hourly run finished — is superseded. It couldn't distinguish a fully-successful day from a partially-failed one, and a single stuck delivery could block the flag from ever being set. Replaced by a per-delivery retry queue that also closes the "was every message actually delivered" gap that Sentry cron monitoring alone doesn't cover. See ADR-010
