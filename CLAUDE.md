# Meal Tracker

Photo-based meal tracking for fitness coaching: clients upload meal photos, the app batches them by meal type, and a daily job sends a consolidated Slack digest to their trainer. Full product context lives in `docs/` — **read the relevant doc before implementing anything in that area**, rather than inferring behavior from the code alone. This is a small, fully-specified product (not a first version of something bigger, per the PRD) with a lot of subtle, deliberately-decided behavior — the docs are where "why" lives, and several requirements (idempotent Slack delivery, the 7-day catch-up window, the shared per-day route with no role check) are easy to get wrong if implemented from intuition instead of from the ADRs.

## Stack

- **Frontend:** Vue 3 + Vite, deployed to Vercel (`apps/web`)
- **Backend:** NestJS on Vercel Functions (`apps/api`)
- **Database:** Neon PostgreSQL (metadata only — no photo bytes)
- **Photo storage:** Cloudflare R2, direct browser upload via presigned URLs
- **Messaging:** Slack API — native file upload, one consolidated message per trainer per day
- **Scheduler:** GitHub Actions, hourly, calling `POST /cron/send-daily-digest`
- **Observability:** Sentry (frontend + backend + cron monitoring)

Cost target: $0/month, free tiers only. See `docs/SYSTEM_DESIGN.md` for the full cost breakdown and `docs/adr/0002-hosting-platform.md` for why this stack was chosen.

## Docs — read before you build

| Doc                      | Read this when...                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`            | You need to know what the product is supposed to do — features, user stories, non-functional requirements, explicit scope boundaries ("Out of Scope" is a real list, not a placeholder)                                                                                          |
| `docs/SYSTEM_DESIGN.md`  | You're implementing anything backend: full Postgres schema (all tables, current as of the latest ADR), every API endpoint, the daily digest job's pseudocode step-by-step, the photo enqueue logic. This is the single most detailed technical doc — start here for backend work |
| `docs/ARCHITECTURE.md`   | You need the big-picture data flow (upload flow, digest delivery flow) or which service talks to which over what protocol                                                                                                                                                        |
| `docs/adr/README.md`     | You're about to make a decision that might contradict a past one — check here first. Points into `docs/adr/0001-*.md` through `0015-*.md`, one file per decision, in dependency order                                                                                            |
| `docs/RUNBOOK.md`        | You're deploying, debugging a failed digest delivery, rotating a secret, or running a diagnostic SQL query against `digest_deliveries`/`digest_messages`                                                                                                                         |
| `docs/design/UI_SPEC.md` | You're building a frontend screen — describes all 6 screens (layout, states, interactions, design tokens) in plain language. The original mockups used a templating syntax that isn't valid Vue; don't try to port markup from them, use this doc instead                        |

## Things that are easy to get wrong if you skip the ADRs

- **The per-day page (`/clients/{client_id}/days/{date}`) has no client-vs-trainer distinction anywhere** — not in the component, not in the API, not in an auth check. Add/Edit/Delete render unconditionally for whoever opens the link. This is intentional (ADR-004: no login at all in the client/trainer flow; ADR-015: management controls are explicitly unconditional). Don't add a role prop or permission check here — there's no signal in a request to base one on.
- **Digest delivery is a resumable, idempotent queue, not a fire-and-forget loop.** Read ADR-010, ADR-012, and ADR-013 together, in that order — each amends the one before, and the schema changes each time (`digest_runs` → `digest_deliveries` → `digest_messages`). `docs/SYSTEM_DESIGN.md`'s "Daily Digest Job" section has the current, final pseudocode; don't implement from ADR-010 alone, it's superseded in two ways.
- **A trainer gets exactly one Slack message per day**, not one per meal (ADR-013). Every meal's photos thread under that single message.
- **The 7-day catch-up window is a product policy, not a technical constraint** (ADR-011) — don't confuse it with anything Slack- or R2-related.
- **Photos never touch the NestJS backend.** Upload is client → R2 direct (presigned URL), and compression/EXIF-reading happens client-side, before upload (ADR-007). If you're writing backend code that expects to receive photo bytes, that's a sign something's off.
- **EXIF must be read before client-side compression, not after** — `canvas.toBlob()` strips EXIF and `canvas.drawImage()` ignores the orientation tag. See System Design's "EXIF Read Must Precede Compression" implementation note.

## Current status

This is a design-complete, not-yet-built product. No frontend or backend implementation exists yet in `apps/web` / `apps/api` beyond the pnpm/Turborepo scaffold. The docs in `docs/` are the full spec to build against.
