# ADR-015: Meal Management Controls Live on the Shared Per-Day Page

**Status:** Accepted
**Date:** 2026-09-22 · **Deciders:** Manish

## Context

ADR-014 put the client's own per-day view and the trainer's per-day view on one identical route, and its Decision text asserted "only the available actions differ (edit/delete for the client, read-only for the trainer)" — without ever saying how that split would actually work. It can't: ADR-004 established no login anywhere in the client or trainer flow, and `client_id` is passed as a plain field, not derived from any session. There is no signal in a request to that route that says "this visitor is the owning client" versus "this visitor is a trainer" versus "this visitor is someone the client texted the link to." ADR-014 quietly assumed a distinction the app has no way to make.

Two ways to close that gap: build a separate management screen distinct from the shareable read-only page (keeping the per-day page purely a view), or accept that Add/Edit/Delete (PRD Feature 4) live on the per-day page itself, available to whoever holds the link. Asked directly, the answer was the latter — on the same page.

## Decision

Add/Edit/Delete render unconditionally on `/clients/{client_id}/days/{date}` for anyone who opens it. There is no client-vs-trainer branch in the component, the API response, or the route — the page returned to a client and the page returned to a trainer (or anyone else holding the link) are the same markup, same data, same buttons. This corrects ADR-014's Decision text, which described a role split that was never actually specified or implementable under ADR-004's no-login model. The Trainer Dashboard's own browsing screen (PRD Feature 3 — the client list and day list) still has no edit affordances built into its chrome; "View Only" describes that screen, not the per-day page it links into.

## Mechanism

```js
// One component, no role prop, no permission check:
GET /meals/history?client_id={id}&from={date}&to={date}       // populates the page, whoever requests it
GET /trainer/clients/{id}/meals?from={date}&to={date}         // same page, reached via the trainer's own dashboard

// Add/Edit/Delete call the same meal-management endpoints System Design already has —
// none of them require anything beyond client_id, matching every other endpoint's access model:
POST   /meals/{meal_id}/photos     // Add
PUT    /meals/{meal_id}            // Edit (meal type)
DELETE /meals/{meal_id}            // Delete a whole meal
DELETE /photos/{photo_id}          // Delete a single photo

// No new auth check is added to any of the four — a request to any of them
// succeeds under exactly the same conditions a GET to the page already does.
```

## Alternatives Considered

| Option                                                                                                         | Pros                                                                                                                                                                                   | Cons                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate management screen, distinct from the shareable read-only per-day page                                 | Keeps the freely-shared link strictly read-only; matches the "View Only" label in PRD Feature 3 literally                                                                              | A second screen showing substantially the same content as the per-day page, kept in sync with it; explicitly declined — the ask was to keep it on the same page                                                                                                                  |
| Client-side navigation-context gating (show controls only when reached via in-app nav, not a bare shared link) | Reduces accidental exposure — a link pasted into Slack renders read-only-looking by default                                                                                            | Not real access control — the same URL still serves the same data and the same underlying endpoints to anyone who requests them; adds a UI branch that protects nothing, just a false sense of one                                                                               |
| Edit-capability query param or token, issued only on the client's own copy of the link                         | At least distinguishes "the client's own link" from a bare forwarded one                                                                                                               | A new mechanism ADR-014 already explicitly declined ("no new auth, no tokens or expiry") for the viewing case; introducing one now for editing contradicts that decision for a narrower slice of the same problem                                                                |
| **No differentiation — accept the trust-model extension, chosen**                                              | Nothing new to build; consistent with ADR-004 and ADR-014, which already made "whoever holds the link" the access model for viewing; simplest answer to "where do these controls live" | A trainer — or anyone else the client forwards a day's link to — can technically add, edit, or delete that client's meals, not just view them. "View Only" in PRD Feature 3 now describes the trainer's own dashboard screen, not a guarantee enforced on the page it opens into |

## Consequences

- No schema or endpoint change — every endpoint Add/Edit/Delete call already existed in System Design with this exact access model; this ADR only settles where their buttons appear
- PRD Feature 3's "(View Only)" heading is now scoped to that dashboard's own list/browse UI, not to the per-day page it links into — worth flagging so a future reader doesn't assume the per-day page enforces it too
- PRD Feature 4 is restructured: its "view history" bullet now names a separate screen (a full list of every day, not the 5-day preview on the Client Dashboard), while Add/Edit/Delete are described as living on the per-day page (Feature 3a), consistent with this decision
- If this risk ever becomes unacceptable in practice (e.g., a trainer accidentally deleting a client's meal), the fix is the one both this ADR and ADR-014 already named and declined: real authentication. Until then this is a conscious, documented trade-off, not an oversight
