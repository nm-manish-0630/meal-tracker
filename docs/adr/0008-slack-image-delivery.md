# ADR-008: Slack Image Delivery — Native File Upload vs Presigned URL

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish · Resolves a known limitation from ADR-007

## Context

ADR-007 embeds a presigned R2 GET URL as the Slack digest's `image_url`. Presigned URLs have a hard 7-day maximum expiry (an S3/R2 protocol limit, not a Cloudflare choice). A digest opened in Slack more than a week after it was sent would show broken images — the message itself persists in Slack forever, but the link it points to stops working.

## Decision

Stop embedding a URL. Instead, during the digest job, NestJS downloads each photo from R2 (free — R2 has zero egress) and uploads it directly into Slack using Slack's current file-upload flow: `files.getUploadURLExternal` → POST the bytes → `files.completeUploadExternal`. The image then lives on Slack's own infrastructure, with no dependency on R2 or a URL surviving over time.

## Alternatives Considered

| Option                                                       | Pros                                                                                                                                    | Cons                                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Keep presigned URL, accept the 7-day limit                   | Zero additional work; already built                                                                                                     | Digests older than a week silently show broken images — a real, if low-likelihood, correctness bug                                        |
| Publicly addressable R2 bucket (unguessable keys, no expiry) | No expiry problem; still just a URL, simple to implement                                                                                | Trades away the presigned URL's access control for convenience; still one more public surface to reason about                             |
| **Native Slack file upload (chosen)**                        | No expiry, ever — the image is Slack's problem once uploaded; no public bucket needed; digest history stays fully viewable indefinitely | 3 Slack API calls per photo instead of embedding 1 URL; digest job does more work (download from R2, then upload) and takes longer to run |

## Consequences

- Slack's old, simpler `files.upload` method is not an option — it was fully sunset on November 12, 2025. The 3-step external-upload flow is the only current method, for any app built today
- Digest job duration grows with photo count (download + 3 API calls per photo); still trivial at current volume, worth watching if photo counts grow substantially
- R2 downloads during the digest job are free (zero egress), so this adds no cost, only latency
- Digest history becomes durable — a message from six months ago shows its photos exactly as it did on day one
- **Note:** this multi-step, per-photo flow is also what makes partial failure a real scenario worth designing for — see ADR-010
