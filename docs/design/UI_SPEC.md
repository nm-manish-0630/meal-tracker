# Meal Tracker — UI Spec

Plain-language description of the 6 mockup screens, extracted from the Cowork Design-canvas mockups built for this project. There is no live app yet — this is the target look, layout, and interaction model to build to.

**A note on the source files:** the original mockups live as `.dc.html` files (`ClientDashboard.dc.html`, `ClientMealHistory.dc.html`, `Main.dc.html`, `PerDayView.dc.html`, `TrainerDashboard.dc.html`, `SlackDigest.dc.html`). Those use a proprietary Cowork "Design canvas" templating syntax (`<x-dc>`, `<helmet>`, `sc-for`, `sc-if`, `{{dotted.lookup}}` template holes, a `data-dc-script`/`DCLogic` component class) that is **not** valid Vue, HTML, or any framework this app is built with — it is not meant to be copied into the codebase or used as a reference for markup structure. This document is the intended reference for implementation; treat the `.dc.html` files (if you have access to them) purely as visual/interaction reference, not as code to port.

## Design System

**Fonts:** Fraunces (display/headings, serif, weights 500/600/700) + Work Sans (body/UI, weights 400–700), both via Google Fonts.

**Color tokens** (CSS custom properties in the mockups — same names work as a starting point for a Tailwind config or CSS variables file):

| Token                                    | Light     | Dark      |
| ---------------------------------------- | --------- | --------- |
| `--bg`                                   | `#F4F9F8` | `#0F1715` |
| `--surface`                              | `#FFFFFF` | `#182420` |
| `--surface-2`                            | `#E1EDEA` | `#223129` |
| `--text`                                 | `#142420` | `#EAF3F0` |
| `--text-secondary`                       | `#56685F` | `#9FB3AC` |
| `--border`                               | `#DCE8E5` | `#29372F` |
| `--accent` (teal)                        | `#0E7C74` | same      |
| `--accent-2` (terracotta)                | `#C1652F` | same      |
| `--warn` (amber, Trainer Dashboard only) | `#D9A441` | same      |

Every screen has a light/dark toggle in its header — a small two-button segmented control (Light / Dark, each with a sun/moon icon), top-right. Selecting one swaps every token above app-wide for that screen.

**Shape language:** generous rounded corners throughout — 12–16px on cards/buttons, 999px (pill) on toggles, chips, and tags. 44px minimum touch target height on every interactive element (buttons, links styled as rows, chips) — accessibility baseline carried through all client-facing screens.

## 1. Client Dashboard (`/` or `/clients/{id}`)

**Viewport:** mobile, 390×844 (phone-sized SPA view).

The client's home screen. Structure, top to bottom:

- **Header:** "Hi Niti" (Fraunces, 24px) + "Let's log today's meals" subtitle, with a circular avatar initial badge (teal, top-right). Light/Dark toggle below it, right-aligned.
- **Stat pair:** two side-by-side cards — "14 days / Logging streak" and "92% / Meals logged" — Fraunces numerals, small secondary-color labels.
- **Today card:** a tappable card labeled "Today · Sep 16" with a "View day →" affordance, linking to the Per-Day View for today. Below the header row, four circular dots (one per meal type — Breakfast/Lunch/Dinner/Snack) — filled teal with a white checkmark if that meal has any photos logged, otherwise an empty outlined circle. Label under each dot.
- **Primary CTA:** full-width teal "+ Add a photo" button, linking to the Client Upload screen.
- **Recent days list:** "Recent days" header with a "View full history →" link (to the Client Meal History screen, item 2 below). Below it, up to ~5 rows, each a tappable card: date + "N photos logged" summary, chevron, linking to that day's Per-Day View.

**Data shown is illustrative/sample** in the mockup (hardcoded streak, compliance %, and day rows) — in the real app these come from `GET /meals/history?client_id={id}` (System Design) aggregated per day, plus whatever streak/compliance calculation the product settles on (not specified in the PRD/System Design — a UI nicety, not a documented backend requirement; may need backend support added if kept).

## 2. Client Meal History (`/clients/{id}/history`)

**Viewport:** mobile, 390×844.

The full, dedicated history screen named in PRD Feature 4 and System Design's Frontend Routes — distinct from the Dashboard's short 5-day preview above. Structure:

- **Header:** back-link to Dashboard (chevron + "Dashboard"), light/dark toggle, "Meal history" title (Fraunces, 24px), subtitle "Every day, since your first upload."
- **Body:** every logged day, grouped by month (most recent month first, e.g. "SEPTEMBER 2026" then "AUGUST 2026" as small uppercase section labels), each month listing its days most-recent-first. Each day is a tappable row: day number + weekday abbreviation on the left, four small dots (on/off per meal type, same on/off styling as the Dashboard's today card) plus a "N photos · M of 4 meals" summary line, chevron on the right — links into that day's Per-Day View.
- **Footer:** total count, e.g. "22 days logged."

This screen calls the same `GET /meals/history?client_id={id}` endpoint as the Dashboard, just without narrowing to a recent range (System Design, Frontend Routes section) — it's a browsable index only; all actual Add/Edit/Delete happens one level down, on the Per-Day View.

## 3. Client Upload — "Add a meal photo" (`Main` screen, reached from the Dashboard's CTA)

**Viewport:** mobile, 390×844.

The upload flow. Two states:

**Idle state:** a large dashed-border tap target — camera icon, "Add a photo" label, helper text "Pick any photo from your library — today's, or one from earlier in the week. We'll read its timestamp." Tapping it moves to the review state.

**Review state** (replaces the idle button once a photo is "picked" — in the mockup this is simulated, cycling through sample photos with different offsets/times to demonstrate the EXIF-driven flow): a card showing a photo placeholder thumbnail, the detected date/time (e.g. "2 days ago · 1:15 PM") with "Detected from the photo's timestamp" helper text, then a row of four meal-type pills (Breakfast/Lunch/Dinner/Snack) with the auto-detected one pre-selected (teal fill) — tapping a different pill overrides it (PRD Feature 1's "Manual override"). Cancel / "Add to log" buttons below.

Below both states, a **"Recently added"** list — small rows showing meal type + date/time for photos just added in this session, newest first, with a photo-icon placeholder thumbnail.

A persistent footer button, **"View full day →"**, links to the Per-Day View so the client can immediately see the day they just added to.

This screen demonstrates PRD Feature 1 end-to-end: EXIF-based auto-detect with 5 possible windows collapsing to 4 displayed meal types (System Design's meal auto-detect windows — Breakfast/Lunch/Snack/Dinner/Snack, with two of those mapping to "Snack"), manual override, and old-photo upload (the "days ago" framing in the sample data specifically demonstrates the 7-day catch-up scenario from PRD Feature 1/US-3).

## 4. Per-Day View (`/clients/{client_id}/days/{date}`) — shared route

**Viewport:** desktop/wide, 960×1100. This is the one screen used identically by both the client and the trainer (ADR-014, ADR-015) — same markup, same data, same controls, regardless of who opens the link.

Structure, top to bottom:

- **Sticky header:** "Niti — Tuesday, September 16" (Fraunces, 30px) + "Every meal photo logged this day, in one shareable page" subtitle. Light/dark toggle, top-right.
- **Share row:** a monospace URL display (`mealtracker.app/clients/c_482/days/2026-09-16`) with a link icon and a "Share" label — visually communicates that the URL itself is the access mechanism (ADR-014's no-token, URL-is-the-access model).
- **Meal-type nav pills:** one pill per meal type that has photos that day (e.g. "Breakfast · 3 photos", "Lunch · 2 photos"), each an in-page anchor link to that section (`#breakfast` etc., per ADR-014's anchor mechanism) — pills only appear for meal types with content, matching PRD 3a's "no anchor to land on" edge case for empty meal types.
- **One section per meal type**, each with:
  - A heading: meal type name + a `#` anchor-link icon + a photo count.
  - **Three action buttons, unconditionally present on every section** (ADR-015 — no client/trainer distinction anywhere): **"Add photo"**, **"Change type"**, **"Delete meal"** (styled as a small pill with a trash/red-tinted label, distinct from the other two).
  - "Change type" toggles an inline row of 4 meal-type pills (Breakfast/Lunch/Dinner/Snack) directly under the header — clicking one re-labels that section immediately (client-side simulation of `PUT /meals/{meal_id}`).
  - A **photo grid** (6 columns) — each photo is a placeholder thumbnail, its captured time underneath, and a text-only **"Remove"** button under each photo (per-photo delete, `DELETE /photos/{photo_id}`).
  - "Add photo" simulates adding one more photo tile to that section's grid (`POST /meals/{meal_id}/photos`); "Delete meal" removes the entire section from the page (`DELETE /meals/{meal_id}`).
- **Empty state:** if every meal for the day has been removed, the sections give way to a centered message: "Every meal for this day has been removed from this page."
- **Footer note:** "That's every photo logged for September 16. Anyone with this link sees this exact page — and can add, edit, or delete here too. There's no separate client or trainer view of this page." — this line is the UI's explicit surfacing of ADR-015's trust-model decision; worth keeping in the real app as a small trust-transparency signal, not just mockup flavor text.

This is the single most implementation-relevant screen in the mockups: it's the concrete rendering of ADR-014 (shareable per-day route + anchors) and ADR-015 (unconditional management controls, no role branch) working together, and it directly maps to the four endpoints System Design's ADR-015 mechanism section lists (`POST /meals/{meal_id}/photos`, `PUT /meals/{meal_id}`, `DELETE /meals/{meal_id}`, `DELETE /photos/{photo_id}`).

## 5. Trainer Dashboard (`/trainer` or similar)

**Viewport:** desktop, 1280×832 — two-pane layout.

- **Left sidebar (300px, fixed):** trainer identity (avatar initials + name "Coach Dana" + "5 clients"), light/dark toggle, then a scrollable client list. Each client row: colored initials avatar, name, a status line ("Uploaded 12m ago" / "No uploads today" / etc.), and an unread dot indicator for clients with new activity. Clicking a row selects that client (highlighted background) and updates the right pane.
- **Right pane:** selected client's name (Fraunces, 28px) + streak/compliance subtitle, and a "Next digest: today at 8:00 PM" info chip, top-right. Below that, a table-like list of days: columns for Day / B / L / D / S (per-meal-type photo counts) / a status note ("In progress — sends at 8 PM" for today, "Caught up in 8 PM digest" for a catch-up day, "Delivered" otherwise) / a chevron. Each row links into the Per-Day View for that client+date — the same shared page described above (item 4), management controls included.

This is PRD Feature 3's "View Only" screen — no edit affordances live in this dashboard's own chrome (the client list and the day-list table have no add/edit/delete anywhere), consistent with ADR-015: "View Only" describes this browsing screen specifically, not the per-day page it links into.

## 6. Slack Digest Preview (not a real app screen — a message mockup)

**Viewport:** 480×760, styled as a Slack DM.

A static preview of what the trainer actually receives, matching ADR-013's consolidated-message design and System Design's Slack Message Format section:

- Small label: "Digest message preview · sent once daily at 8:00 PM"
- A message card: Meal Tracker app icon + name + timestamp (8:00 PM)
- "Hi Dana," greeting
- **"Meal photos for today (Sep 16):"** section — one row per meal type with a teal dot, e.g. "Breakfast — 5 photos"
- Divider
- **"Remaining meal photos for yesterday (Sep 15):"** section — same per-meal-type rows, terracotta dot to visually distinguish the catch-up section from the "today" section
- Divider, then a **6-column thumbnail grid** ("Threaded below this message") showing photo placeholders labeled by meal-type initial (B/L/D/S), with a "+26" tile indicating more photos than fit in the preview
- Footer caption: "Photos are threaded under this one message — no new message posts until tomorrow at 8:00 PM, even if more photos arrive tonight."

This mockup is a visual reference for exactly the Slack Block Kit structure documented in System Design's "Slack Message Format" section — a `chat.postMessage` header with a "today" bucket plus one "remaining meal photos for `<date>`" bucket per distinct catch-up date, followed by every claimed meal's photos uploaded natively (ADR-008) and threaded under that one message's `ts` (ADR-013). It is not a screen the frontend renders — it exists only inside Slack, built by the backend digest job.
