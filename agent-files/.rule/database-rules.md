# Database Rules

## Purpose
- Define database source-of-truth expectations, migration behavior, and bootstrap guidance.

## Source of Truth
- **Prisma schema** (`chore-app/backend/prisma/schema.prisma`) is the source of truth for all database models and relationships.
- No standalone `schema.sql` file — Prisma manages schema through migrations.
- Prisma generates the client from the schema file (`npx prisma generate`).

## Core Models
- User, Lead, Student, Group, TrialLesson, Task, ActivityLog, LeadIntake, Notification, Conversation, Message, ExternalRef, MessageTemplate, AutomationRule, ScheduledMessage
- See the Prisma schema for full field definitions.

## WhatsApp / Automation (Phase 2)
- `MessageTemplate` — approved WhatsApp templates; `name` unique; `status` gates sends (only APPROVED may be sent).
- `AutomationRule` — trigger→template mapping with `offsetMinutes` timing; `active` flag halts a rule without a deploy.
- `ScheduledMessage` — automation outbox; `@@index([status, dueAt])` for cron dispatch; `messageId` unique links the sent `Message`; `dedupeKey` unique for idempotent enqueue; `entityType`/`entityId` (`@@index`) reference the triggering entity for dispatch-time re-checks and cancellation; `status` values `PENDING`, `SENDING`, `SENT`, `FAILED`, `CANCELLED` (`SENDING` is a transient claim guarding overlapping 5-minute dispatch ticks).
- Provider secrets (`WHATSAPP_*`) live in `.env` only, never in the database or committed.

## External Reference and Idempotency
- `ExternalRef` maps an internal entity to its identifier in an external system (Meta, Instagram, website, WhatsApp, Google Calendar).
- Idempotency key: `@@unique([system, externalId])` — the same external event never creates a duplicate internal record.
- Reference is polymorphic: `entityType` (LEAD, STUDENT, TRIAL_LESSON, GROUP, MESSAGE, CONVERSATION) + `entityId`, indexed via `@@index([entityType, entityId])`. No DB-level foreign key — written only by services, never client-supplied.

## Communication Spine
- `Conversation` is channel-scoped and belongs to a lead (or student); `Message` holds direction (INBOUND/OUTBOUND), channel, body, and delivery status.
- Provider message IDs are stored via `ExternalRef` (entityType MESSAGE), not as columns.

## Enum Handling
- SQLite does not support native enums.
- All enum-like fields use `String` type with `@default("VALUE")`.
- Valid values are documented in the schema via comments, not enforced at the DB level.
- Application-level validation enforces allowed values.

## Migration Rules
- Use `npx prisma migrate dev --name <description>` for schema changes.
- Each migration gets a descriptive name (e.g., `crm-core-init`, `add-lead-source-field`).
- After schema changes, always run `npx prisma generate` to update the client.
- For breaking changes in development, it is acceptable to delete `dev.db` and migration history and start fresh.

## PrismaClient Pattern
- Use the singleton pattern at `src/lib/prisma.ts`.
- All route and service files import from `../lib/prisma` — never instantiate `new PrismaClient()` directly.

## JSON Fields
- `ActivityLog.metadata` and `LeadIntake.rawPayload` use JSON type.
- These fields are for logging/audit purposes, not for querying.
- SQLite stores JSON as text — no native JSON operators available.

## Operational Notes
- SQLite is acceptable for small-team, single-server deployment.
- `dev.db` is disposable — can be regenerated from any schema state via `prisma migrate dev`.
- No production data exists — development database only.
