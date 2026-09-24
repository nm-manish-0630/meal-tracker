# ADR-001: Photo Storage Method

**Status:** Superseded by [ADR-007](0007-photo-storage-revised-r2.md)
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

Meal photos need to be stored and retrieved for the daily Slack digest. The two common approaches are object storage (S3) with a reference key in the DB, or storing the binary directly in PostgreSQL (BYTEA). This is a low-traffic product with a small, fixed user base, and cost/simplicity matter more than raw scalability.

## Decision

Store photos as `BYTEA` directly in the Neon PostgreSQL `photos` table, rather than using AWS S3.

## Alternatives Considered

| Option                        | Pros                                                                                    | Cons                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **PostgreSQL BYTEA (chosen)** | Single system to manage; free on Neon's tier; simpler backups (one DB, not two systems) | DB grows larger; not ideal at high photo volume                                      |
| AWS S3                        | Purpose-built for file storage; scales indefinitely; offloads DB size                   | Extra service to configure/monitor; extra cost at scale; two systems to keep in sync |

## Consequences

- At ~500KB/photo and current usage, DB stays well within Neon's 5GB free tier for roughly a year
- If photo volume grows significantly (many more clients), revisit and migrate to S3
- No separate file-storage credentials or SDK needed — one connection string for everything
- **Superseded:** discovered during hosting exploration that Vercel/Netlify serverless functions cap request bodies at 4.5–6MB — far under the 50MB upload target this ADR didn't yet need to account for. Photos moved to Cloudflare R2 via presigned uploads — see ADR-007
