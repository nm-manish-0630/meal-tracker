# ADR-007: Photo Storage, Revised — Cloudflare R2 via Presigned Uploads

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish · Supersedes ADR-001

## Context

ADR-001 chose PostgreSQL BYTEA for photo storage, on the reasoning that a single system is simpler than two and stays free on Neon's tier. That reasoning was sound given what was known at the time, but it rested on an assumption that turned out to be false: that the backend could actually receive a photo.

While evaluating Netlify as a Vercel alternative, we found that **Vercel Functions cap request bodies at 4.5MB and Netlify Functions at 6MB** (the latter is an AWS Lambda limit underneath). The PRD targets 50MB uploads to accommodate iPhone originals. A request that size is rejected with a 413 before any application code runs — so server-side compression could never have rescued it either, since Sharp would never see the bytes. Every design up to this point assumed an upload path that physically could not work on the chosen host.

## Decision

Store photos in `Cloudflare R2`, uploaded **directly from the browser** via presigned URLs. The `photos` table stores an `r2_object_key` instead of `photo_binary`. NestJS generates presigned PUT URLs (for upload) and presigned GET URLs (for dashboards and the Slack digest), but never handles the file bytes itself.

## Alternatives Considered

| Option                                                             | Pros                                                                                                                                                                                                                                                 | Cons                                                                                                                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep BYTEA, compress client-side to fit under 4.5MB                | No new service; ADR-001 stands; smallest change                                                                                                                                                                                                      | Caps photo quality at whatever fits the payload limit; the DB still carries all photo weight against Neon's 5GB; fragile — a limit change or a stubborn photo breaks uploads    |
| AWS S3 + presigned uploads                                         | Same direct-upload pattern; the industry default                                                                                                                                                                                                     | S3 is no longer durably free for accounts created after July 2025 (credit-pool model, ~~6 months), and charges egress (~~$0.09/GB) — every dashboard photo view costs money     |
| Move backend to a host with no payload ceiling (Render, Cloud Run) | Could keep BYTEA exactly as designed                                                                                                                                                                                                                 | Solves a storage problem by changing hosting; Render free tier sleeps (cold starts), Cloud Run means Docker/gcloud/IAM setup — both larger changes than the one actually needed |
| **Cloudflare R2 + presigned uploads (chosen)**                     | Payload limit becomes irrelevant — bytes never touch the backend; free tier is recurring and permanent (10GB, 1M writes, 10M reads, **zero egress**); S3-compatible, so the standard AWS SDK works unchanged; frees Neon's 5GB entirely for metadata | One more service and credential to manage; requires CORS configuration on the bucket; presigned GET URLs expire (see Consequences)                                              |

## Consequences

- Upload becomes a three-step flow: `POST /meals/upload-url` → browser PUTs directly to R2 → `POST /meals/confirm-upload` writes the metadata row. One endpoint became two, and the client does more of the work
- **Image compression moves to the client**, reversing the server-side-Sharp decision recorded earlier. Once the backend never receives raw bytes, server-side processing is structurally impossible in this flow — compression happens in the browser (canvas API) before upload
- Neon's 5GB free tier now holds metadata only, so database growth is negligible and effectively unbounded in practical terms; photo growth is tracked separately against R2's 10GB
- **Known limitation, resolved by ADR-008:** presigned URLs have a hard 7-day maximum expiry (an S3/R2 protocol constraint, not a Cloudflare choice), which would have made digest messages opened in Slack more than a week later show broken images. The digest no longer embeds a presigned URL — see ADR-008
- Deleting a photo or meal must now delete the R2 object too, not just the database row — two systems to keep in sync, which is exactly the cost ADR-001 was trying to avoid. That cost is now justified by the payload constraint that ADR-001 didn't know about
- Bucket requires CORS configuration to permit direct browser uploads from the app's domain
