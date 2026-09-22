# ADR-014: Per-Day Shareable Routes with Meal-Type Anchors

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** Manish

## Context

The client and trainer dashboards (PRD Features 3 and 4) browse meals by date range — there was no way to point at one specific day's photos with a single link. Wanted: a URL for "this client's meals on this date," with each meal type (Breakfast/Lunch/Dinner/Snack) individually deep-linkable, so sharing "here's Tuesday's breakfast" is one URL instead of "open the dashboard, find Tuesday, scroll to breakfast."

Two things needed settling before this could be designed rather than just described: which dashboard(s) get it, and what "shareable" means given the app has no login anywhere in the client/trainer flow (ADR-004) — a URL that works for anyone holding it is a bigger claim than a UI convenience once you say it out loud.

## Decision

One route, `/clients/{client_id}/days/{date}`, used identically by both the client's own dashboard and the trainer's view of a client — same URL shape, same page, same controls, no matter who opens it (see ADR-015, which corrects this ADR's original assumption that actions would differ by role). The page shows every meal type logged that date on one page, each in a section with an id (`#breakfast`, `#lunch`, `#dinner`, `#snack`); a URL with that hash scrolls straight to it via Vue Router's built-in `scrollBehavior`. The URL itself is the access control — same trust model as every other client_id-bearing link in the app today, no new auth mechanism. No new backend endpoint: both views call the existing meal-history endpoints with `from = to = date`.

## Mechanism

```js
// Route (Vue Router)
{ path: '/clients/:clientId/days/:date', component: DayView }

// Data: reuse existing endpoints, single-day range
GET /meals/history?client_id={clientId}&from={date}&to={date}         // client's own view
GET /trainer/clients/{clientId}/meals?from={date}&to={date}           // trainer's view

// Anchor scroll (built into Vue Router, no custom JS):
scrollBehavior(to) {
  if (to.hash) return { el: to.hash, behavior: 'smooth' }
}

// Each meal-type section, rendered only if that meal has photos that day:
<section id="breakfast">...</section>
<section id="lunch">...</section>
<section id="dinner">...</section>
<section id="snack">...</section>
// A hash for a meal type absent that day matches no element — the browser just doesn't scroll.
// Not an error state, nothing to special-case.
```

A date with no meals logged at all renders an empty-state page ("No meals logged for this day") rather than a blank one — the one edge case worth an explicit UI state, since every other case (missing meal type, missing photos within a meal type) degrades to "that section just isn't there."

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| Query param instead of path segment (`/dashboard?date=2026-09-16`) | Smaller router change | Reads worse as a shared link, and doesn't compose as cleanly with the meal-type hash — a path segment is the more natural "this is a specific resource" URL |
| Separate route prefixes for client vs. trainer (`/client/days/...` vs `/trainer/days/...`) | Slightly more explicit about which dashboard is which | Two routes to maintain for identical page content; the client_id in the path already disambiguates whose day it is, and which chrome renders is a runtime concern, not a routing one |
| Signed or expiring share links | Tighter access control than a plain guessable-in-principle URL | A new mechanism (token issuance, expiry handling) that nothing else in the app has — explicitly out of scope per the confirmed decision to match the existing no-login trust model, not extend it |
| **One shared route, path-based, no new auth, chosen** | Simplest possible version that satisfies the actual ask; reuses existing data endpoints entirely; consistent with every other URL in the app already carrying `client_id` as its access control | Anyone who obtains a link can view that day's photos indefinitely, no expiry — an explicit, accepted extension of ADR-004's existing trust model, not a new risk it didn't already have |

## Consequences

- Purely additive on the backend — no schema change, no new endpoint. This is a frontend routing feature built entirely on data the API already returns
- The URL is now an explicit, intentional sharing mechanism rather than an incidental one — worth remembering if the no-login model (ADR-004) is ever revisited, since anything that adds auth needs to keep "share this link with someone" working, not just "log in and browse"
- PRD Feature 4's "reassign a photo to a different meal" line is removed as part of this pass — it named a feature that was never built and directly contradicted ADR-012's explicit "reassignment doesn't exist" consequence; the two documents were quietly out of sync until now
- Amended by ADR-015: this ADR's Decision originally claimed the page would show "edit/delete for the client, read-only for the trainer" without ever specifying how, given no login (ADR-004). That claim wasn't actually implementable and has been corrected above — the page is identical for every visitor
