# ADR-006: Notification Channel Storage

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

Trainers need to receive the daily digest via Slack today, but the app may support email, WhatsApp, or other channels later. The question is whether to store a Slack-specific field on `users` or design for multiple channels from the start.

## Decision

Create a dedicated `notification_preferences` table (`user_id`, `channel`, `channel_identifier`, `is_primary`) instead of a `slack_user_id` column on `users`.

## Alternatives Considered

| Option                                      | Pros                                                                                                                                   | Cons                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `slack_user_id` column on users             | Simplest possible implementation while only Slack is used                                                                              | Locks the schema to Slack; adding email/WhatsApp later means a schema migration |
| **notification_preferences table (chosen)** | Channel-agnostic from day one; a trainer can have multiple channels with one marked primary; no migration needed to add channels later | Slightly more setup while only one channel is used today                        |

## Consequences

- Adding email or WhatsApp notifications later is a data change, not a schema change
- Daily digest job looks up the primary channel per trainer rather than assuming Slack
- Slightly more upfront design effort, justified by avoiding rework
