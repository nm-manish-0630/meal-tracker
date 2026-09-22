# ADR-005: Client-Trainer Relationship Modeling

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

A client needs to be associated with a trainer group so their daily digest reaches the right trainer(s). This relationship could be a simple foreign key on the client, or a separate junction table.

## Decision

Use a direct `trainer_group_id` column on `users` instead of a separate `client_groups` junction table. This matches how trainers already link to their group, so clients and trainers now use the same pattern.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Direct FK on users (`trainer_group_id`) (chosen)** | Simpler schema, one less table; consistent with how trainers already link to a group; assignment is just a field update via the existing admin/users endpoint | No history — can't tell when a client switched trainer groups; no audit trail |
| Junction table (`client_groups`) | Full history of assignments over time via `assigned_at`/`ended_at`; supports a client changing trainer groups cleanly | One extra table and join in queries, for a history feature that isn't needed |

## Consequences

- Reassigning a client to a different trainer group is a single-field update, with no record of the prior assignment
- Simpler queries throughout — no join needed anywhere a client's trainer group is looked up
