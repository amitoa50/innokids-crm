# System Architecture

## Purpose
- Provide a concise architecture reference for service boundaries, ownership, and major flows.

## Context
INNOKIDS CRM is an internal operating system for a coding school for kids and teens. It replaces external paid tools with a single system for lead management, sales pipeline, trial lesson coordination, student enrollment, and internal task management. The system is designed for a small team (admin + staff) and operates as a monolithic full-stack application.

## Primary Components

### Backend (Express + TypeScript, port 4000)
- **Routes layer** — RESTful API endpoints for each entity (lead, student, group, trial-lesson, task, report, lead-intake, user, notification, auth)
- **Services layer** — business logic (dedup, conversion, activity logging, phone normalization, source normalizers, communication logging, external-ref mapping, group capacity)
- **Communication spine** — channel-agnostic conversation + message model; parent contact history per lead/student. WhatsApp and other channels attach as adapters over this spine (Phase 2+).
- **External-reference map** — links internal entities to external-system IDs (Meta, Instagram, website, WhatsApp, Google Calendar) for intake idempotency and future two-way sync.
- **Pipeline engine** — application-level allowed-transition map (`lib/pipeline.ts`) enforced in `lead.service`; system/auto transitions use the same validated setter.
- **Middleware** — JWT auth with role guards, API key validation for webhooks, requestId generation
- **Prisma ORM** — data access layer with SQLite database
- **Cron** — daily overdue follow-up check + auto-stage advancement (post-trial → FOLLOW_UP_AFTER_TRIAL, stale leads → NO_RESPONSE) via node-cron
- **Email** — optional Gmail SMTP via Nodemailer

### Frontend (React 18 + TypeScript + Vite, port 5173)
- **Pages** — Dashboard, Leads, LeadDetails, Tasks, TrialLessons, Calendar, Students, StudentDetails, Groups, Team, Login
- **Components** — modals (LeadModal, TaskModal, etc.), StatusBadge, ActivityTimeline, ConfirmDialog, NotificationBell, Layout
- **State** — TanStack Query v5 for server state, react-hook-form for forms
- **Styling** — Tailwind CSS v4 + CSS custom properties for design tokens
- **Calendar** — FullCalendar v6 with RTL/Hebrew locale

### Database (SQLite via Prisma)
- Single-file database (`dev.db`)
- Models: User, Lead, Student, Group, TrialLesson, Task, ActivityLog, LeadIntake, Notification, Conversation, Message, ExternalRef
- String fields for enums (SQLite limitation)
- `ExternalRef` idempotency key: `@@unique([system, externalId])`; polymorphic reference via `entityType` + `entityId`

## Data Flow

### Standard Request Flow
1. Client sends HTTP request with JWT in Authorization header
2. requestId middleware assigns UUID v4, sets `x-request-id` header
3. Auth middleware verifies JWT, attaches user to request
4. Route handler calls service layer
5. Service performs business logic, writes to DB via Prisma
6. Service creates ActivityLog entries for auditable actions
7. Service creates Notifications for relevant users
8. Response includes requestId in header and body

### Webhook Lead Intake Flow
1. External platform POSTs to `/api/lead-intake/webhook/:source`
2. API key middleware validates `x-api-key` header
3. Raw payload logged to LeadIntake table
4. Source-specific normalizer extracts standard fields
5. Phone number normalized to +972 format
6. Dedup check by phoneNormalized
7. Lead created, merged, or reopened based on dedup result
8. LeadIntake record updated with result status
9. Notification created for admin/assigned staff
10. ActivityLog entry created

### Pipeline Transition Flow
1. Status change requested (client via `PUT /api/lead/:id/status`, or a service/cron auto-transition)
2. `lead.service` validates the move against `lib/pipeline.ts` allowed-transition map
3. Illegal move → `409 INVALID_TRANSITION` (client) or skipped (auto)
4. Legal move → status updated, `ActivityLog` `STATUS_CHANGE` recorded
5. Auto-stage triggers: trial `NO_SHOW` → lead `NO_RESPONSE` (+ follow-up task); trial `COMPLETED` → `TRIAL_COMPLETED` (+ follow-up date/task); daily cron advances post-trial leads to `FOLLOW_UP_AFTER_TRIAL` and ages stale leads to `NO_RESPONSE`

## Integration Architecture (Phase 2+)
All external channels connect as **adapters over the hardened core**, never by reshaping it. Each adapter provides up to four pieces:
- **Inbound webhook** — receive external events (leads, messages) and normalize into pipeline/communication spine
- **Outbound sender** — send to the external system (e.g. WhatsApp message), recording delivery status on `Message`
- **External-ID map** — `ExternalRef` links our entity to the provider's ID for idempotency and two-way sync
- **Secrets/config** — per-channel tokens/config (stored outside the repo; never committed)

Channel notes:
- **WhatsApp (Phase 2)** — bi-directional over the conversation/message spine; gated by lead consent; template messages outside the 24h window
- **Meta / Instagram lead ads** — native verification (`hub.verify_token` GET challenge + `X-Hub-Signature-256` HMAC), `leadgen_id` as `ExternalRef` idempotency key; today's generic `x-api-key` webhook is bridged via an intermediary until the native adapter exists
- **Website forms** — already fit the existing `x-api-key` webhook + `website` normalizer
- **Calendar** — Google Calendar two-way sync using structured schedule fields + `ExternalRef` (system `GOOGLE_CALENDAR`) event IDs

## Auth and Role Boundaries
- **Public** — `/api/auth/login`, `/api/auth/register`
- **API key** — `/api/lead-intake/webhook/:source`
- **Authenticated (All roles)** — all other endpoints
- **Admin only** — user management (`/api/user`), staff performance reports, group creation
- Roles: ADMIN (full access), STAFF (operational, no settings)
- Future: TEACHER role (V2)

## External Dependencies
- **Gmail SMTP** (optional) — outbound email via Nodemailer
- **Webhook sources** (future) — Facebook Lead Ads, Instagram, website forms
- **WhatsApp Business API** (Phase 2) — communication engine
- No external database — SQLite local file

## Operational Concerns
- **Logging** — requestId attached to all responses for traceability
- **Error shape** — `{ error: { code, message, details? }, requestId }` on all non-2xx responses
- **No test suite** — manual validation only (documented)
- **Single-user concurrency** — SQLite acceptable for small team
- **Email fallback** — silently skipped if SMTP not configured

## Change Log
- 2026-07-04: Initial architecture for INNOKIDS CRM Core (Phase 1)
- 2026-07-06: CRM data-model hardening (plan 003) — added communication spine (Conversation, Message), ExternalRef map, consent fields, pipeline transition engine, auto-stage logic, group capacity enforcement, calendar-readiness fields; added Integration Architecture section

## Update Triggers
- Update this file when API routes, auth boundaries, or major component ownership changes.
