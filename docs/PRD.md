# Meal Tracker — Product Requirements Document

Photo-based meal tracking for fitness coaching.

## Product Vision

A lightweight app that enables fitness coaches to receive daily photo digests of their clients' meals via Slack. Clients take photos of meals, the app batches them by meal type, and automatically sends them to trainers at a configured time daily for easy review and feedback.

## Target Users

**Who this is for:** Fitness coaches & clients with 1:1 coaching relationships. This is the complete, final scope — not a first version of something larger.

| User Type | Goal | Pain Point |
|---|---|---|
| **Client** | Share meal photos with coach | Manual photo texting/emailing is tedious |
| **Trainer** | Review client meals daily | Photos scattered across messages, hard to batch review |
| **Admin (You)** | Manage clients, trainers, and groups | Otherwise requires direct database edits for any roster change |

Two people fill these three roles today: Manish is both the Client and the Admin; the trainer is a separate person.

## Core Features

### 1. Client Photo Upload

- **Upload meal photo:** Client takes/selects photo from phone
- **Auto-detect meal type:** By EXIF timestamp — Breakfast 5-10am, Lunch 11am-2pm, Snack 2-4pm, Dinner 4-9pm, Snack any other time (including the 10-11am gap and overnight)
- **Manual override:** Client can change auto-detected meal type
- **Multiple photos:** Max 5 photos per meal (1 photo = breakfast eggs, 2 photos = breakfast eggs + juice, etc.)
- **Upload old photos:** If a photo was taken up to 7 days ago but uploaded today, it's grouped into that day's meal and included in the trainer's single daily digest message, sent at the configured digest time — as a "remaining meal photos for `<date>`" line if that meal never had a delivery, or threaded under its existing message if it did. Not a separate, immediate Slack post — see Feature 2

### 2. Daily Slack Digest

- **Auto-send at configured time:** Batch all meals from the day into one Slack message (default 8pm, one shared time for everyone, editable via Admin Dashboard)
- **Format by meal type:** Breakfast section, Lunch section, Dinner section, Snack section
- **Show all photos:** Display all photos inline (up to 5 per meal)
- **Include timestamps:** Show capture time for each meal (e.g., "Lunch - 12:45pm")
- **Send to trainer group:** Goes to all trainers assigned to the client's group
- **Late/backdated catch-up (7 days):** A meal dated within the last 7 days that was missed on its own day — or that gains new photos after already being sent — still reaches the trainer, included in that day's single daily digest message at the configured digest time: a "remaining meal photos for `<date>`" line if the meal never had a delivery, or the new photos added to its existing message's thread if it did. Catch-up never triggers an immediate, separate Slack post — it waits for the same daily send as everything else. No duplicate header message is ever sent for the same meal. Meals older than 7 days, and any meal-type edit or deletion, stay dashboard-only, same as before

### 3. Trainer Dashboard (View Only)

- **List clients:** Trainer sees all assigned clients
- **View meal history:** Browse past meals by date range
- **Per-day shareable link:** Each date has its own URL showing all of that client's meals for that day; each meal-type section has its own anchor, so a link like `/clients/<id>/days/<date>#breakfast` opens straight to that meal, scrolled into view — see Feature 3a
- **"View Only" describes this screen, not the page it opens into:** the client list and day list here have no edit affordances. Clicking into a specific day, though, opens the exact same per-day page a client uses (Feature 3a) — Add/Edit/Delete (Feature 4) included. There's no login to enforce a stricter boundary on that page (ADR-004), so this is a trust-model choice, not a technical guarantee — see ADR-015

### 3a. Per-Day Routes & Anchors

- **One route, one page, every meal that day:** `/clients/<client_id>/days/<date>` shows Breakfast, Lunch, Dinner, and Snack for that date on a single page — not the multi-day range view. Same route pattern for the client's own dashboard and the trainer's view of a client.
- **Meal-type anchors:** each meal section has an id (`#breakfast`, `#lunch`, `#dinner`, `#snack`); visiting the URL with that hash scrolls straight to it. A meal type with nothing logged that day simply has no anchor to land on — no error, the page just opens at the top.
- **Shareable, matching the existing trust model:** the URL itself is the access, same as every other client_id-bearing link in the app (no login, ADR-004) — whoever holds the link can open it. No new share mechanism, no tokens or expiry.
- **No new backend endpoint:** built entirely on the existing meal-history endpoints (a single-day range query) — this is a frontend routing feature, not a new API surface.
- **Management controls included:** Add/Edit/Delete (Feature 4) render on this same page, for whoever opens it — the page doesn't distinguish client from trainer from anyone else holding the link. An explicit, accepted extension of the trust model above — see ADR-015.

### 4. Client Meal History & Management

- **View history, on its own screen:** a dedicated screen listing every day the client has ever logged meals, most recent first — separate from the Client Dashboard's short recent-activity preview (today's status plus the last few days). This screen is a browsable index; selecting a day opens the per-day page below
- **Per-day shareable link:** Same route and anchor pattern as the trainer's per-day view (Feature 3a) — the client's own day is just as linkable and jumpable-to
- **Add, Edit, Delete — on the per-day page, not the history list:** upload more photos to a past meal (5-photo max), change a meal's type, or remove a photo/meal, all from the per-day page itself (Feature 3a). That page is shared, unmodified, with the trainer's view (ADR-014), so these controls aren't restricted to the client who owns the meals — anyone holding that day's link has them too. An accepted trade-off, not an oversight — see ADR-015
- **No duplicate resend, narrowed:** A meal-type edit or a deletion never triggers any Slack action — the trainer's dashboard view (Feature 3) is the only place those show up. A *new photo* added to a meal already covered by a sent digest is the one exception: if the meal is within the 7-day catch-up window (Feature 2), the new photo is threaded under that meal's existing Slack message — the original header is never resent

### 5. Admin Dashboard (CRUD)

- **Manage clients:** Create, edit, deactivate client accounts
- **Manage trainers:** Create, edit, deactivate trainer accounts and their notification channels
- **Manage trainer groups:** Create groups, assign/reassign clients, end assignments
- **Configure digest settings:** Set the one shared digest send time (applies to everyone), and each trainer group's own timezone (so meal-day boundaries stay correct)

## User Stories

**US-1 (Client):** As a client, I want to upload a photo of my breakfast so that my coach can see what I ate.
- Can take new photo or select from camera roll
- Photo auto-tagged as "Breakfast" if taken 5-10am
- Can override meal type if incorrect
- Upload succeeds with visual confirmation

**US-2 (Trainer):** As a trainer, I want to receive all my client's meals in one daily Slack message so I can review them quickly.
- Message arrives at the configured time (same moment for every trainer group)
- Meals grouped by type (Breakfast, Lunch, Dinner, Snack)
- All photos visible inline
- Can forward/save Slack message for records

**US-3 (Client):** As a client, I want to upload yesterday's (or up to 7 days ago's) meal today and have my trainer actually see it, not just have it sit in a dashboard nobody checks.
- Photo EXIF timestamp read automatically
- Photo grouped into correct day+meal
- Trainer sees it in their next daily digest message (sent once, at the configured digest time) within 7 days of the meal's date — a "remaining meal photos for `<date>`" line if that meal was missed entirely, or the photo threaded under the meal's existing message if part of it already sent. Not a separate Slack message of its own
- The original message, if one already existed, is never resent or duplicated — only the new photo is added
- Trainer can also view in dashboard for historical records, including anything older than 7 days

**US-4 (Trainer):** As a trainer with 3 clients, I want one Slack message per client daily.
- Separate message for each client (not mixed)
- Client name in message header
- All arrive within 5 minutes of the configured send time

**US-5 (Client):** As a client, I want to view and manage my past meal photos so I can review my history and fix mistakes.
- Can browse all past meals grouped by date
- Can edit a meal's type or delete a photo/meal
- A meal-type edit or a deletion never changes or resends anything already sent to Slack — those only ever update the dashboard
- Adding a new photo to a meal within the last 7 days is the one action that does reach Slack — via the next daily digest message (threaded under the meal's existing message, or a "remaining meal photos for `<date>`" line if it never had a delivery — see US-3), never an immediate, separate post
- Changes are reflected next time the trainer opens their dashboard

**US-6 (Admin):** As the app owner, I want to create/edit/remove clients and trainers without touching the database directly.
- Can create a new client or trainer account
- Can assign/reassign a client to a trainer group
- Can set the one shared digest send time, and each trainer group's own timezone
- Can deactivate an account without deleting its historical data

## Non-Functional Requirements

### Performance

- **Upload:** Photo upload completes in <5 seconds (including EXIF extraction, image processing, DB store)
- **Slack send:** Daily digest sent to all trainer groups within an hour of the configured send time (hourly check cadence)
- **Dashboard load:** Trainer, Client, and Admin dashboards each load in <2 seconds

### Availability

- **Uptime SLA:** 99.5% (sufficient for a small, fixed user base)
- **Daily digest:** Must not miss the configured send time (monitored + alerts)

### Data & Security

- **Photo retention:** Delete after 1 year (GDPR compliance)
- **Authentication:** No login for client/trainer flows — client_id passed directly. Sufficient for a small, fixed, trusted set of users; would only need revisiting if that changes
- **Admin access:** The admin dashboard can create, edit, and delete client/trainer records — protected by a basic shared password even though client/trainer flows stay open. Decided (ADR-004: Accepted).
- **Data integrity:** No photo loss; verify uploads land in R2 before confirming

### Scalability

- **Current users:** 2 people across 3 roles (1 client, 1 trainer, 1 admin — Manish holds both the client and admin roles)
- **Growth headroom:** Design comfortably supports up to ~10 clients / 3 trainers on the same single-database setup — no architecture changes needed if usage grows

## Design Constraints

- **Cost:** $0/month (free tiers only: Vercel, Neon, Cloudflare R2, GitHub Actions)
- **Max photos/meal:** 5 (prevents DB bloat, manageable Slack format)
- **Photo size:** Max 50MB per photo on upload (iPhone originals can exceed 10MB); uploaded directly to Cloudflare R2, so this never hits the backend's request-size limits. Compressed client-side before upload
- **Daily digest time:** One global send time (default 8pm), shared by every trainer group, set via Admin Dashboard — not hardcoded. Each group's own timezone still determines which meals count as that day's digest
- **Slack only:** The only notification channel built and wired up; the data model already supports adding others later without a schema change (see ADR-006)
- **Late photo catch-up window:** 7 days. A meal dated within the last 7 days that was missed, or that gains a new photo after already being sent, still reaches the trainer — folded into that day's single daily digest message, sent once at the configured digest time, never as an immediate separate post. Older than 7 days, or any meal-type edit/deletion at any age, is dashboard-only. This is a policy cutoff, unrelated to Slack file storage limits — see ADR-011 and ADR-013

## Out of Scope

- OAuth / advanced auth — not needed for a small, fixed, trusted user base
- Trainer feedback/comments (one-way digest only)
- Meal macro tracking (photos only, no calorie calc)
- Mobile app (responsive web only)
- Integrations beyond Slack (email, WhatsApp, etc.)
- Batch upload (one photo at a time)
- Video support (photos only)
- Multi-language (English only)
- Search/filter across clients or meals in the trainer dashboard

This list reflects the complete, final scope of the product — not a backlog for a future version. If a real need arises later, it can be reconsidered on its own merits.

## Success Metrics

| Metric | Target | Why It Matters |
|---|---|---|
| **Upload success rate** | >95% | Photos reliably reach trainer |
| **Daily digest send reliability** | 100% (no missed days) | Trainer depends on the daily digest arriving |
| **EXIF auto-detect accuracy** | >90% | Meals grouped into correct type |
| **Avg photo upload time** | <5 seconds | Good UX, clients don't abandon |
| **Database size** | <50MB (1 year data) | Photos live in R2, not Postgres (ADR-007) — Neon only holds metadata + delivery/attempt records, so this is a trivial target, not a real constraint |
| **Edit/delete success rate** | >99% | Clients trust their history is accurate |

## Timeline

| Phase | Duration | Deliverables |
|---|---|---|
| **Phase 1: Backend Core** | 1-2 weeks | NestJS + Neon + R2 setup, presigned upload flow (50MB limit), EXIF extraction |
| **Phase 2: Trainer Digest** | 1 week | Vue 3 upload UI, Slack API, daily digest job, GitHub Actions cron, configurable digest time |
| **Phase 3: Client Dashboard** | 3-5 days | Meal history view, edit meal type, delete photo/meal |
| **Phase 4: Admin Dashboard** | 3-5 days | CRUD on clients/trainers/trainer groups, digest settings, basic access protection |
| **Phase 5: Polish** | 1 week | Error handling, client-side image compression, testing, deployment |
| **🚀 Launch** | — | Live product with 2 users (Manish + trainer) |

Updated from the original 3-4 weeks to ~4-6 weeks to reflect the added Client and Admin dashboards.
