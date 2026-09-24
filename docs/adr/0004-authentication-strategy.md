# ADR-004: Authentication Strategy

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Manish

## Context

The product has exactly 2 known people today, across 3 roles (1 client, 1 trainer, 1 admin — Manish holds both the client and admin roles) and is not planned to grow into a multi-tenant product — this is the final scope, not a first version. Building full authentication (JWT/OAuth) adds complexity that doesn't add value at this scale, but the app still needs to identify which client is uploading, and the Admin Dashboard's CRUD access to all records raises the stakes for that one surface specifically.

## Decision

No login for client or trainer flows — `client_id` is passed directly as a form field. The Admin Dashboard is the one exception: it sits behind a basic shared password, since it can create, edit, and delete client/trainer records.

## Alternatives Considered

| Option                                                              | Pros                                                             | Cons                                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **No login for client/trainer, shared password for admin (chosen)** | Fastest to build; matches the actual trust level of each surface | Client/trainer endpoints aren't secure for public/multi-tenant use; anyone with the URL could impersonate a client |
| Hardcoded JWT everywhere                                            | Basic protection without full OAuth complexity                   | Extra implementation time not justified for a fixed, trusted, 2-user product                                       |
| Full OAuth                                                          | Production-grade, ready for multi-tenant growth                  | Significant overhead for a product with no multi-tenant plans; premature for the actual scope                      |

## Consequences

- Client/trainer endpoints are only as safe as the URLs staying unshared — acceptable given the fixed, trusted user base this product is built for
- The Admin Dashboard's shared password is a minimum bar, not full auth — adequate for a single operator (Manish)
- If the trusted user base ever genuinely changes, proper auth (JWT at minimum) would need revisiting — but that's a future reconsideration on its own merits, not a planned phase of this product
