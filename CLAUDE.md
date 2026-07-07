# CLAUDE.md

## Projects

### chore-app/ — INNOKIDS CRM

Full-stack CRM system for INNOKIDS, a coding school for kids and teens. Manages the full lifecycle from lead intake through student enrollment.

**Purpose:** Captures leads from multiple sources (ads, website, manual), tracks them through an 8-stage sales pipeline, coordinates trial lessons, converts leads to enrolled students, and manages groups and internal tasks. Hebrew RTL interface.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite (port 5173) |
| Styling | Tailwind CSS v4 + CSS custom properties + lucide-react icons |
| Calendar | FullCalendar v6 |
| State/Data | TanStack Query v5 + axios |
| Forms | react-hook-form |
| Toasts | sonner |
| Backend | Node.js + Express v5 + TypeScript (port 4000) |
| ORM | Prisma v5 |
| Database | SQLite (dev.db) |
| Auth | JWT + bcryptjs |
| Email | Nodemailer + Gmail SMTP (optional) |
| Scheduler | node-cron (daily overdue follow-up check) |
| IDs | uuid v4 (requestId generation) |

---

## Project Structure

```
chore-app/
  backend/
    src/
      index.ts                  # Entry point, cron job, admin seed
      lib/
        prisma.ts               # PrismaClient singleton
        requestId.ts            # UUID v4 request ID middleware
        phoneNormalizer.ts       # Israeli phone normalization
      middleware/
        auth.ts                 # JWT verification + role guard
        apiKey.ts               # Webhook API key validation
      routes/
        auth.ts                 # POST /api/auth/login, /register
        lead.ts                 # Lead CRUD + pipeline operations
        leadIntake.ts           # Webhook lead intake endpoints
        student.ts              # Student CRUD
        group.ts                # Group CRUD + student assignment
        trialLesson.ts          # Trial lesson scheduling
        task.ts                 # Internal task management
        report.ts               # Dashboard, pipeline, source stats
        user.ts                 # Team management (admin only)
        notification.ts         # In-app notification polling
      services/
        lead.service.ts         # Lead business logic (dedup, conversion)
        student.service.ts
        group.service.ts
        trialLesson.service.ts
        task.service.ts
        activityLog.service.ts  # Activity logging
        notification.service.ts
        email.ts                # Nodemailer wrapper
        normalizer/
          facebook.ts           # Meta Lead Ads normalizer
          instagram.ts          # Instagram normalizer
          website.ts            # Website form normalizer
          default.ts            # Generic fallback normalizer
    prisma/schema.prisma        # DB schema (source of truth)
    .env.example
  frontend/
    src/
      App.tsx                   # Router + QueryClient setup
      main.tsx
      api/client.ts             # Axios instance (baseURL, auth header)
      hooks/useAuth.tsx         # Auth context + JWT storage
      styles/
        main.css                # CSS entry point
        setup/variables.css     # Design tokens (CSS custom properties)
        basics/typography.css   # Base text styles
        cmps/badge.css          # Status badge styles
        cmps/timeline.css       # Activity timeline styles
      types.ts                  # Shared TypeScript interfaces
      pages/
        Login.tsx
        Dashboard.tsx           # Stats, pipeline, recent activity
        Leads.tsx               # Lead table with filters
        LeadDetails.tsx         # Lead detail + timeline
        Tasks.tsx               # Task table with filters
        TrialLessons.tsx        # Trial lesson management
        Calendar.tsx            # FullCalendar (trials, follow-ups, groups)
        Students.tsx            # Student table
        StudentDetails.tsx      # Student detail view
        Groups.tsx              # Group cards
        Team.tsx                # Admin: manage staff
        Automation.tsx          # Admin: read-only automation rules + outbox monitor
      components/
        Layout.tsx              # Sidebar nav + header
        NotificationBell.tsx    # Polls every 30s
        LeadModal.tsx           # Create/edit lead
        TaskModal.tsx           # Create/edit task
        TrialLessonModal.tsx    # Schedule trial lesson
        StudentModal.tsx        # Create student (conversion)
        GroupModal.tsx           # Create/edit group
        StatusBadge.tsx         # Pipeline status badge
        ActivityTimeline.tsx    # Activity log timeline
        ConfirmDialog.tsx       # Confirmation modal
```

---

## Data Model

### Lead Pipeline
`NEW` → `CONTACTED` → `NO_RESPONSE` → `TRIAL_SCHEDULED` → `TRIAL_COMPLETED` → `FOLLOW_UP_AFTER_TRIAL` → `CONVERTED` → `CLOSED`

### Lead Sources
`FACEBOOK`, `INSTAGRAM`, `WEBSITE`, `MANUAL`, `OTHER`

### Roles
`ADMIN` (full access), `STAFF` (operational, no settings)

### Key Entities
- **Lead** — parent/customer contact, tracked through pipeline. Phone-based dedup with +972 normalization.
- **Student** — enrolled child, created via lead conversion.
- **Group** — class group (Scratch, Python, etc.) with schedule and capacity.
- **TrialLesson** — trial class linked to lead and optionally to group.
- **Task** — internal follow-up/to-do, optionally linked to lead or student.
- **ActivityLog** — audit trail for all actions on leads/students.
- **LeadIntake** — webhook audit log for external lead sources.
- **Conversation** — channel-scoped thread (WhatsApp/email/SMS/phone/manual) belonging to a lead or student.
- **Message** — single inbound/outbound communication inside a conversation, with delivery status.
- **ExternalRef** — maps internal entities to external-system IDs (Meta/Instagram/website/WhatsApp/Calendar). Idempotency key `@@unique([system, externalId])`.
- **MessageTemplate / AutomationRule / ScheduledMessage** — WhatsApp template registry, automation trigger→template rules, and the cron-dispatched automation outbox (Phase 2).

---

## API Routes

All routes use singular entity names. Error responses follow shape: `{ error: { code, message, details? }, requestId }`.

| Route prefix | Description |
|-------------|-------------|
| `/api/auth` | Login, register |
| `/api/lead` | Lead CRUD, status changes (transition-guarded), assign, convert, reopen, notes, conversation/message logging |
| `/api/lead-intake` | Webhook intake (`POST /webhook/:source`), intake log |
| `/api/student` | Student CRUD |
| `/api/group` | Group CRUD, add/remove students |
| `/api/trial-lesson` | Trial lesson scheduling and status |
| `/api/task` | Task CRUD, complete |
| `/api/report` | Dashboard stats, pipeline, source, staff performance |
| `/api/user` | Team management (admin only) |
| `/api/notification` | In-app notifications |
| `/api/whatsapp` | WhatsApp webhook (verify + inbound + status callbacks); provider-verified, not JWT |
| `/api/automation` | Automation monitoring + template content (admin only): list rules, list `ScheduledMessage` outbox with per-status counts, read `MessageTemplate`s with usage, edit template body |

---

## Setup & Commands

### Backend (run from `chore-app/backend/`)

```bash
npm install
cp .env.example .env      # set JWT_SECRET, WEBHOOK_API_KEY; optionally GMAIL_USER + GMAIL_APP_PASSWORD
npm run db:generate       # generate Prisma client
npm run db:migrate        # create/migrate dev.db
npm run dev               # nodemon + ts-node (hot reload)
npm run build             # compile to dist/
npm start                 # run compiled build
npm run db:studio         # Prisma Studio GUI
```

### Frontend (run from `chore-app/frontend/`)

```bash
npm install
npm run dev               # Vite dev server
npm run build             # tsc + vite build
npm run preview           # preview production build
```

---

## Key Notes

- **No test suite** — no unit or integration tests exist.
- **Default admin credentials (first run):** `admin@office.local` / `admin123` — change after first login.
- **Email is optional:** if `GMAIL_USER`/`GMAIL_APP_PASSWORD` are unset, email is silently skipped; in-app notifications still work.
- **Webhook API key:** set `WEBHOOK_API_KEY` in `.env` for lead intake security.
- **Phone dedup:** Israeli numbers normalized to +972 format. `phoneNormalized` is the unique dedup key.
- **Roles:** `ADMIN` can manage team, settings, and all entities; `STAFF` can work leads, tasks, trials, students, groups.
- **Hebrew RTL:** entire UI is in Hebrew with `dir="rtl"` and `lang="he"`.
- **CSS architecture:** `styles/main.css` imports setup/variables, basics, and cmps. CSS custom properties for design tokens.
- **Error handling:** all API responses include `requestId` (UUID v4). Error shape: `{ error: { code, message, details? }, requestId }`.
- **No trailing semicolons** in any TS/JS file.
- **Singular entity names** in routes and service files.
- **PrismaClient singleton** at `src/lib/prisma.ts` — never instantiate directly.
- **Express v5** handles async errors natively (no try/catch wrappers needed).
- **SQLite** uses string fields for enums (no native enum support).
- **Pipeline transitions** are guarded application-side via `src/lib/pipeline.ts` (allowed-transition map). Illegal moves return `409 INVALID_TRANSITION`. Auto-stage: trial `NO_SHOW` → lead `NO_RESPONSE`; trial `COMPLETED` → `TRIAL_COMPLETED` + follow-up; daily cron advances post-trial leads to `FOLLOW_UP_AFTER_TRIAL` and ages stale leads to `NO_RESPONSE`.
- **Communication spine:** channel-agnostic `Conversation` + `Message`. WhatsApp and other channels attach as adapters (Phase 2). Consent (`whatsappConsent`, `marketingConsent`, `preferredChannel`) gates outbound messaging.
- **External-ID idempotency:** lead intake with an `externalId` (e.g. Meta `leadgen_id`) is deduped via `ExternalRef` before phone dedup; replays return the same lead.
- **Group capacity** enforced on assignment/conversion — full group returns `409 GROUP_FULL` and flips `status` to `FULL`.
- **WhatsApp (Phase 2):** provider-agnostic adapter in `src/services/whatsapp/` (`WHATSAPP_PROVIDER=cloud|mock`). Inbound opens a 24h `service window` on the lead; outbound is consent-gated (`NO_CONSENT` 409), session-only inside the window and template-only outside it (`WINDOW_CLOSED_NO_TEMPLATE` 422). Provider message ids deduped via `ExternalRef`. Secrets in `.env` only (`WHATSAPP_*`), never committed.
- **WhatsApp automation (Phase 2b):** event-driven engine in `src/services/automation.service.ts` — pipeline events enqueue `ScheduledMessage` rows (idempotent via `dedupeKey`) into an outbox drained by a 5-minute `node-cron` tick (gated by `AUTOMATION_ENABLED`), separate from the daily 00:00 job. Sends are template-only, consent/window-gated, and re-check stop conditions at dispatch time; a claimed row goes `PENDING → SENDING → SENT`, and failures mark `FAILED`/`CANCELLED` with a reason + admin notification. Six seeded rules: lead welcome, no-response nudge, trial confirmation/reminder, post-trial follow-up, no-show reschedule, student welcome. Group first-lesson fan-out and multi-step sequences are reserved.
