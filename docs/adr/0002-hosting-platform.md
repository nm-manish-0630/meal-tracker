# ADR-002: Hosting Platform

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

Need to host a Vue 3 frontend, a NestJS backend, and a PostgreSQL database. Primary constraint: keep monthly cost at $0 for this product while still supporting a scheduled job.

## Decision

Host frontend + backend on `Vercel` (free tier) and database on `Neon PostgreSQL` (free tier).

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Vercel + Neon (chosen)** | $0/month; zero server management; auto-deploys from Git | Serverless functions can't run persistent background processes (affects cron — see ADR-003) |
| VPS (DigitalOcean/Hetzner) + Neon | Full control; persistent process supports internal cron natively | $5-10/month; manual server maintenance, OS updates, security patches |
| Replit + Neon | 2 components instead of 3; built-in persistent process | Free tier is resource-limited and can sleep when inactive, risking missed cron runs |

## Consequences

- True $0/month cost, which was the deciding constraint
- Requires an external trigger for the daily digest job (addressed in ADR-003)
- Scales automatically if usage grows, without infrastructure changes
