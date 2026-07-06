# Plan 003: CRM Data-Model Hardening (Pre-Phase-2)

Status: done
Owner: Amit Ohana
Last updated: 2026-07-06

---

## Goal

Harden the INNOKIDS CRM Core data model and pipeline logic so the system is ready to become the central operating system for future integrations (WhatsApp, Meta/Instagram lead ads, website forms, calendar). This plan adds the missing communication spine, external-system reference mapping, consent tracking, pipeline transition safety, auto-stage logic, intake idempotency, sales-relevant child fields, group capacity enforcement, and calendar-readiness fields.

This is a **data-model and business-rule hardening pass only**. It does **not** implement any external integration (no WhatsApp sending, no Meta signature verification, no Google Calendar sync). Those remain Phase 2+. The purpose is to make sure the CRM structure is correct *before* integrations hang off it, so integrations become adapters rather than schema rewrites.

## Scope

**In scope:**
- New Prisma models: `Conversation`, `Message`, `ExternalRef`
- New fields on `Lead` (consent/opt-in, child sales fields, preferred channel)
- New fields on `Group` (structured schedule / calendar-readiness) and `TrialLesson` (duration, location/meeting)
- Application-level pipeline transition rules (allowed-transition map) enforced in `lead.service`
- Auto-stage logic: trial `NO_SHOW` → lead `NO_RESPONSE`; post-trial follow-up handling for `FOLLOW_UP_AFTER_TRIAL`
- Lead intake idempotency via `ExternalRef` (external IDs such as Meta `leadgen_id`)
- Group capacity enforcement on assignment and on conversion-into-group
- New `communication.service` and `externalRef.service`; minimal manual message-logging endpoints
- Minimal frontend surfacing: consent + child fields in `LeadModal`, conversation panel in `LeadDetails`, group schedule fields in `GroupModal`, capacity error toasts
- Documentation updates: `product-definition.md`, `architecture.md`, `glossary.md`, `database-rules.md`, `CLAUDE.md`
- One Prisma migration for all schema changes

**Out of scope (Phase 2+):**
- WhatsApp Business API send/receive adapter, delivery-status webhooks, template approval flow
- Meta/Instagram native webhook verification (`hub.verify_token` + `X-Hub-Signature-256`)
- Google Calendar two-way sync (event creation/update)
- Website landing-page form build-out
- Payment / billing / enrollment plan management
- Automation engine / trigger-based flows
- Test suite (repo currently has none, per `CLAUDE.md` and `testing-rules.md`)

## Assumptions

- SQLite remains the database; all enum-like fields stay `String` with valid values documented as schema comments (per `database-rules.md`).
- Prisma schema (`chore-app/backend/prisma/schema.prisma`) remains the single source of truth.
- Express v5 native async error handling continues; no try/catch wrappers.
- PrismaClient singleton at `src/lib/prisma.ts` continues.
- Error responses keep the shape `{ error: { code, message, details? }, requestId }` (per `error-handling-rules.md`).
- No trailing semicolons in any TS file (per `coding-rules.md`).
- Singular domain names in routes/services (per `naming-rules.md`).
- CSS via `styles/main.css` → setup/basics/cmps with CSS variables; casing done in CSS not code (per `style-rules.md`).
- `sonner` for toasts, `lucide-react` for icons (per `ui-rules.md`).
- `dev.db` is disposable; a fresh migration is acceptable (no production data).
- All new UI text is Hebrew RTL.
- This is additive hardening; existing Phase-1 flows keep working.

## Open Questions

> **Resolved 2026-07-06 — approved "you can start" with all recommended answers accepted.**
> 1: base from `feat/crm-core`. 2: incremental additive migration. 3: allow `NEW → TRIAL_SCHEDULED`. 4: keep `TRIAL_COMPLETED`, cron-advance to `FOLLOW_UP_AFTER_TRIAL`. 5: age stale leads to `NO_RESPONSE` after 3 days. 6: add child fields. 7: keep rejecting phone-less intake for V1. 8: polymorphic `ExternalRef` with unique idempotency key.

1. **Base branch.** Create `feat/crm-hardening` from `feat/crm-core` (unmerged Phase 1), or from `main`?
   - **(rec)** From `feat/crm-core`, since this hardening builds directly on Phase-1 entities that are not yet in `main`.

2. **Migration strategy.** Reset `dev.db` with a fresh single migration, or add an incremental `add-crm-hardening` migration on top of existing data?
   - **(rec)** Incremental migration `crm-hardening` — all changes are additive (new models + nullable/defaulted fields), so no reset is needed and any hand-entered smoke-test data survives.

3. **Pipeline transition map.** Confirm the allowed transitions below (see Step 4). Key business question: can staff schedule a trial directly from `NEW` (so `NEW → TRIAL_SCHEDULED` is allowed)?
   - **(rec)** Yes — allow scheduling a trial from `NEW`, `CONTACTED`, or `NO_RESPONSE`.

4. **Post-trial follow-up semantics.** When a trial is marked `COMPLETED`, should the lead go to `TRIAL_COMPLETED` (current) and *then* move to `FOLLOW_UP_AFTER_TRIAL` via a separate action, or jump straight to `FOLLOW_UP_AFTER_TRIAL`?
   - **(rec)** Keep `TRIAL_COMPLETED` as the immediate state, auto-create a follow-up task + set `nextFollowUpDate` (+2 days), and let the daily cron advance still-open post-trial leads to `FOLLOW_UP_AFTER_TRIAL`. Preserves the "trial just happened" signal for reporting.

5. **Auto `NO_RESPONSE` aging.** Besides trial `NO_SHOW` → `NO_RESPONSE` (deterministic), should the daily cron also age leads in `NEW`/`CONTACTED` with a passed `nextFollowUpDate` into `NO_RESPONSE` after N days?
   - **(rec)** Yes, N = 3 days with no contact. Configurable constant, not hardcoded per call site.

6. **Child fields on Lead (item 7 — "only if needed").** Add `childName` + `childBirthYear` to `Lead`?
   - **(rec)** Yes — the sales conversation is about the child; staff need it on the lead card pre-conversion, and it carries over to `Student` on convert. Minimal cost, clear UX value.

7. **Meta leads without a phone.** Meta lead-ads leads occasionally lack a phone; `Lead.phoneNormalized` is required + unique. Keep rejecting phone-less intake (current), or relax phone to optional?
   - **(rec)** Keep phone required for V1 (kid-school leads almost always include a phone). Revisit when the Meta native adapter is built in Phase 2. Documented as a known limitation.

8. **ExternalRef modeling.** Use a polymorphic `entityType` + `entityId` (flexible, no FK integrity) or dedicated nullable FK columns per entity?
   - **(rec)** Polymorphic with a `@@unique([system, externalId])` idempotency key and `@@index([entityType, entityId])`. Trade-off (no DB-level FK) is acceptable for SQLite/small-team and matches the audit-style use.

## Steps

### Step 1: Documentation updates (no code risk — do first)

Per `AGENTS.md`, docs are updated when schema/routes/architecture change. Update **before** touching code.

- `agent-files/.doc/glossary.md` — add canonical terms: `conversation`, `message`, `external-ref`, `consent` / `opt-in`, `pipeline-transition`, `preferred-channel`. Define singular/route/code usage for each.
- `agent-files/.doc/product-definition.md` — reframe scope so the CRM is explicitly the "central operating system" that integrations connect to. Add communication tracking + consent to Phase-1-hardening scope. Move WhatsApp/Meta/website/calendar into a described "Integration Roadmap (Phase 2+)" subsection with the adapter principle. Add consent/lead-response as success metrics.
- `agent-files/.doc/architecture.md` — add `Conversation`, `Message`, `ExternalRef` to the model list; add a "Communication spine" component; add an "Integration architecture (Phase 2+)" section describing the inbound-webhook / outbound-sender / external-id-map / secrets-store adapter pattern for WhatsApp, Meta, website, calendar; note pipeline transition enforcement in the data-flow; add a Change Log entry dated 2026-07-06.
- `agent-files/.rule/database-rules.md` — add `Conversation`, `Message`, `ExternalRef` to Core Models; document the `ExternalRef` idempotency key convention (`@@unique([system, externalId])`) and the polymorphic reference pattern.
- `CLAUDE.md` (repo root, `codingacademyproject/CLAUDE.md`) — add new entities to Data Model + API Routes tables; add communication/consent/external-ref notes to Key Notes; add pipeline-transition-rules note.

Deliverable of this step: docs describe the target state. No behavior changes yet.

### Step 2: Branch setup

- Create `feat/crm-hardening` from the base branch chosen in Open Question 1 (**rec:** `feat/crm-core`), per `versioning-rules.md` (one workstream per branch, never work on `main`).

### Step 3: Database schema — new models and fields

**File to modify:** `chore-app/backend/prisma/schema.prisma`

Additive only. Valid enum values documented as trailing comments (per `database-rules.md`).

- **New model `Conversation`** — `id`, `leadId Int?`, `studentId Int?`, `channel String` (WHATSAPP, EMAIL, SMS, PHONE, MANUAL, SYSTEM), `status String @default("OPEN")` (OPEN, SNOOZED, CLOSED), `lastMessageAt DateTime?`, timestamps. Relations to `Lead?` and `Student?`, and `messages Message[]`.
- **New model `Message`** — `id`, `conversationId Int`, `direction String` (INBOUND, OUTBOUND), `channel String`, `body String`, `status String @default("LOGGED")` (LOGGED, PENDING, SENT, DELIVERED, READ, FAILED, RECEIVED), `templateName String?`, `sentById Int?` (staff who logged/sent; null for inbound/automated), `sentAt DateTime?`, `createdAt`. Relations to `Conversation` and `User?`.
- **New model `ExternalRef`** — `id`, `entityType String` (LEAD, STUDENT, TRIAL_LESSON, GROUP, MESSAGE, CONVERSATION), `entityId Int`, `system String` (META, INSTAGRAM, WEBSITE, WHATSAPP, GOOGLE_CALENDAR), `externalId String`, `metadata String?` (JSON), `createdAt`. Constraints: `@@unique([system, externalId])`, `@@index([entityType, entityId])`.
- **`Lead` — add fields:**
  - Consent: `whatsappConsent Boolean @default(false)`, `whatsappConsentAt DateTime?`, `marketingConsent Boolean @default(false)`, `preferredChannel String?` (WHATSAPP, PHONE, EMAIL)
  - Child sales fields: `childName String?`, `childBirthYear Int?`
  - Relation: `conversations Conversation[]`
- **`Student` — add:** relation `conversations Conversation[]`
- **`Group` — add calendar-readiness fields:** `startTime String?` (HH:mm), `endTime String?` (HH:mm), `startDate DateTime?`, `timezone String? @default("Asia/Jerusalem")`. Keep existing `dayOfWeek`/`time` for backward compatibility (mark `time` as legacy in comment).
- **`TrialLesson` — add:** `durationMinutes Int? @default(45)`, `locationType String?` (ONLINE, IN_PERSON), `meetingUrl String?`
- **`User` — add:** relation `sentMessages Message[]`

Then:
- Run `npx prisma migrate dev --name crm-hardening` (or reset per Open Question 2)
- Run `npx prisma generate`

Note: external calendar event IDs and provider message IDs are stored via `ExternalRef`, **not** as columns — keeping entities clean and idempotency centralized.

### Step 4: Backend — pipeline transition rules + auto-stage logic

**File to create:** `chore-app/backend/src/lib/pipeline.ts`
- Export `allowedTransitions: Record<string, string[]>` (proposed, pending Open Question 3):
  - `NEW` → CONTACTED, NO_RESPONSE, TRIAL_SCHEDULED, CLOSED
  - `CONTACTED` → NO_RESPONSE, TRIAL_SCHEDULED, CLOSED
  - `NO_RESPONSE` → CONTACTED, TRIAL_SCHEDULED, CLOSED
  - `TRIAL_SCHEDULED` → TRIAL_COMPLETED, NO_RESPONSE, CLOSED
  - `TRIAL_COMPLETED` → FOLLOW_UP_AFTER_TRIAL, CONVERTED, CLOSED
  - `FOLLOW_UP_AFTER_TRIAL` → CONVERTED, NO_RESPONSE, CLOSED
  - `CONVERTED` → CLOSED
  - `CLOSED` → NEW (reopen)
- Export `canTransition(from, to): boolean` and `FOLLOW_UP_AFTER_TRIAL_DELAY_DAYS`, `NO_RESPONSE_AGING_DAYS` constants.

**File to modify:** `chore-app/backend/src/services/lead.service.ts`
- `updateLeadStatus` — reject disallowed transitions with a domain error the route maps to HTTP `409` code `INVALID_TRANSITION` (per `error-handling-rules.md` state-conflict guidance). Automated/system transitions call a shared internal setter that still validates against the map.
- Keep `ActivityLog` `STATUS_CHANGE` entries.

**File to modify:** `chore-app/backend/src/services/trialLesson.service.ts`
- `updateTrialStatus`:
  - On `NO_SHOW` → set lead `NO_RESPONSE`, set `nextFollowUpDate` (+1 day), create a `FOLLOW_UP` task for the assigned staff (auto-stage for `NO_RESPONSE`).
  - On `COMPLETED` → keep lead `TRIAL_COMPLETED`, set `nextFollowUpDate` (+`FOLLOW_UP_AFTER_TRIAL_DELAY_DAYS`), create a post-trial follow-up task (feeds `FOLLOW_UP_AFTER_TRIAL`).
- `createTrialLesson` — set `TRIAL_SCHEDULED` via the validated setter instead of a raw update.

**File to modify:** `chore-app/backend/src/index.ts`
- Extend the daily cron: advance still-open post-trial leads (`TRIAL_COMPLETED` with passed `nextFollowUpDate`) to `FOLLOW_UP_AFTER_TRIAL`; optionally age stale `NEW`/`CONTACTED` leads to `NO_RESPONSE` after `NO_RESPONSE_AGING_DAYS` (pending Open Question 5). All via the validated setter, logged to `ActivityLog`.

### Step 5: Backend — external-ref, communication, capacity, intake idempotency

**Files to create:**
- `chore-app/backend/src/services/externalRef.service.ts` — `linkExternalId({ entityType, entityId, system, externalId, metadata? })` (idempotent upsert on `[system, externalId]`), `findByExternalId(system, externalId)`.
- `chore-app/backend/src/services/communication.service.ts` — `getOrCreateConversation(leadId | studentId, channel)`, `logMessage({ conversationId, direction, channel, body, sentById?, status?, templateName? })` (updates `Conversation.lastMessageAt`, writes an `ActivityLog` entry so messages appear in the timeline).

**Files to modify:**
- `chore-app/backend/src/services/group.service.ts` — `addStudentToGroup` counts current students vs `maxCapacity`; if full, throw a domain error mapped to `409` `GROUP_FULL`; when capacity reached, set `Group.status = "FULL"`; `removeStudentFromGroup` restores `status = "ACTIVE"` when back under capacity.
- `chore-app/backend/src/services/lead.service.ts` — `convertLead` applies the same capacity check when `groupId` is provided.
- `chore-app/backend/src/services/normalizer/*.ts` and the `NormalizedLead` interface — add optional `externalId` (Meta `leadgen_id`, website submission id, etc.).
- `chore-app/backend/src/routes/leadIntake.ts` — after normalization, if `externalId` present, check `externalRef.findByExternalId(system, externalId)`; on hit, return the existing lead idempotently and mark the `LeadIntake` row `DUPLICATE_EXTERNAL` (add to status comment list); on miss, run existing phone dedup, then `linkExternalId(...)` to the resulting lead. Keep the current phone-less rejection (Open Question 7).

### Step 6: Backend — routes for communication (minimal, manual logging)

Nested under lead per existing conventions (`/note`, `/convert`, `/assign`):
**File to modify:** `chore-app/backend/src/routes/lead.ts`
- `GET /api/lead/:id/conversation` — return conversations + messages for the lead.
- `POST /api/lead/:id/message` — manually log a parent communication (`channel`, `direction`, `body`); validates required fields with the standard error shape; calls `communication.service`.

No outbound WhatsApp send route in this plan (Phase 2).

### Step 7: Frontend — minimal surfacing (Hebrew RTL, CSS-variable tokens)

**Files to modify:**
- `chore-app/frontend/src/types.ts` — add `Conversation`, `Message`, `ExternalRef` interfaces; extend `Lead` (consent, `preferredChannel`, `childName`, `childBirthYear`); extend `Group` (schedule fields) and `TrialLesson` (`durationMinutes`, `locationType`, `meetingUrl`).
- `chore-app/frontend/src/components/LeadModal.tsx` — add child fields (שם הילד/ה, שנת לידה), WhatsApp consent toggle, preferred-channel select.
- `chore-app/frontend/src/components/GroupModal.tsx` — add structured schedule fields (start/end time, start date).
- `chore-app/frontend/src/pages/LeadDetails.tsx` — add a "תקשורת" (communication) panel listing conversation messages with a manual "log message" action; keep the activity timeline.
- `chore-app/frontend/src/components/StudentModal.tsx` / conversion flow — surface `GROUP_FULL` error via `sonner` toast.
- `chore-app/frontend/src/styles/cmps/` — add a small `conversation.css` (message bubbles inbound/outbound) using CSS variables; import it from `styles/main.css`. Casing/labels handled in CSS where applicable.

Keep new UI minimal and consistent with existing components; no new libraries.

### Step 8: Validation (see Validation section)

## Validation

Per `testing-rules.md` (no automated suite) — manual + type/build checks:

1. **Schema:** `npx prisma generate` succeeds; `npx prisma migrate dev --name crm-hardening` applies cleanly; existing rows intact.
2. **Backend types:** `npx tsc --noEmit` passes with zero errors in `chore-app/backend/`.
3. **Pipeline rules:** `PUT /api/lead/:id/status` with an illegal jump (e.g. `NEW → CONVERTED`) returns `409` `INVALID_TRANSITION` with `requestId`; a legal transition succeeds and logs `STATUS_CHANGE`.
4. **Auto-stage:** marking a trial `NO_SHOW` moves its lead to `NO_RESPONSE` + creates a follow-up task; marking `COMPLETED` keeps `TRIAL_COMPLETED` + sets `nextFollowUpDate` + creates a post-trial task.
5. **Capacity:** assigning students up to `maxCapacity` flips group to `FULL`; the next assignment returns `409` `GROUP_FULL`; removing one restores `ACTIVE`.
6. **Intake idempotency:** replaying the same webhook payload with the same `externalId` returns the same `leadId` and marks the second intake `DUPLICATE_EXTERNAL` (no duplicate lead).
7. **Communication:** `POST /api/lead/:id/message` logs a message; `GET /api/lead/:id/conversation` returns it; it appears in the lead activity timeline.
8. **Consent + child fields:** creating a lead with WhatsApp consent + child name persists and displays; converting copies child data to the student.
9. **Frontend build:** `npx tsc -b --noEmit` and `npx vite build` pass; manual smoke of LeadModal, LeadDetails communication panel, GroupModal schedule, capacity toast.
10. **Error shape:** every new non-2xx response matches `{ error: { code, message, details? }, requestId }`.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Additive migration conflicts with hand-entered smoke-test data | Blocks dev | Fields are nullable/defaulted; if it fails, reset disposable `dev.db` (Open Question 2) |
| Transition map too strict for real staff workflow | Staff blocked mid-sale | Map is a single reviewable constant; confirm via Open Question 3 before enforcing |
| Polymorphic `ExternalRef` lacks FK integrity | Orphaned refs | `@@unique` idempotency key + `@@index`; refs written only by services, never client-supplied |
| Auto-stage cron mislabels leads | Wrong pipeline counts | Deterministic triggers first (`NO_SHOW`); aging cron gated behind Open Question 5 with a configurable threshold |
| Communication model under-built for real WhatsApp | Rework in Phase 2 | Model designed channel-agnostic with direction/status/externalId now; only the adapter is deferred |
| Scope creep into Phase 2 integration | Delays hardening | Integrations explicitly out of scope; this plan stops at data model + manual logging |
| SQLite JSON (`ExternalRef.metadata`) not queryable | Limited lookups | Metadata is audit-only; lookups use indexed `system`/`externalId` columns |

## Rollout Order

1. **Step 1** — Documentation updates (no code risk)
2. **Step 2** — Branch `feat/crm-hardening`
3. **Step 3** — Schema + migration (additive) → checkpoint: `prisma generate` + `migrate`
4. **Step 4** — Pipeline transition rules + auto-stage logic
5. **Step 5** — externalRef / communication / capacity / intake idempotency services
6. **Step 6** — Communication routes
7. **Checkpoint: backend** — `tsc --noEmit`, manual endpoint tests (Validation 3–7, 10)
8. **Step 7** — Frontend surfacing
9. **Checkpoint: frontend** — `tsc -b --noEmit`, `vite build`, manual smoke (Validation 8–9)
10. **Final** — full end-to-end pass of the hardened flow

## Rollback

- All work on `feat/crm-hardening`; base branch and `main` untouched.
- Additive migration: revert by `git checkout` of `schema.prisma` + dropping the `crm-hardening` migration, or reset the disposable `dev.db`.
- No production data exists.
- If a single step breaks, fix on the branch; never force-merge to `main` (per `versioning-rules.md`). Merge only on explicit approval.

## Priority Mapping (your 9 items → this plan)

| # | Your item | Priority | Where |
|---|-----------|----------|-------|
| 1 | Conversation / Message model | P0 | Step 3, 5, 6 |
| 2 | ExternalRef model | P0 | Step 3, 5 |
| 3 | Consent / opt-in fields | P0 | Step 3, 7 |
| 4 | Pipeline transition rules | P1 | Step 4 |
| 5 | Auto-stage NO_RESPONSE / FOLLOW_UP_AFTER_TRIAL | P1 | Step 4 |
| 6 | Lead intake idempotency via external IDs | P1 | Step 5 |
| 7 | Child fields on lead (if needed) | P2 — recommended yes | Step 3, 7 |
| 8 | Group capacity enforcement | P2 | Step 5 |
| 9 | Calendar-readiness fields | P2 | Step 3, 7 |

## Execution Log (2026-07-06)

Executed on branch `feat/crm-hardening` (from `feat/crm-core`). Not committed, not merged.

- Docs updated: `glossary.md`, `product-definition.md`, `architecture.md`, `database-rules.md`, root `CLAUDE.md`.
- Schema: added `Conversation`, `Message`, `ExternalRef`; consent + child fields on `Lead`; schedule fields on `Group`; duration/location fields on `TrialLesson`. Migration `20260706102315_crm_hardening` applied (additive, existing data intact); Prisma client regenerated.
- Backend: `lib/pipeline.ts` (transition map + constants); `setLeadStatus` guard in `lead.service`; auto-stage in `trialLesson.service` + cron; `externalRef.service`, `communication.service`; group capacity in `group.service` + `convertLead`; intake idempotency in `leadIntake` + normalizer `externalId`.
- Frontend: types extended; `LeadModal` (child + consent + preferred channel); `LeadDetails` (communication panel + transition-error toast + child/consent info); `GroupModal` (schedule fields); `StudentModal` (GROUP_FULL toast); `cmps/conversation.css`.

Validation results (all pass):
- Backend `tsc --noEmit`: 0 errors. Frontend `tsc -b --noEmit` + `vite build`: 0 errors.
- Pipeline: `NEW → CONVERTED` → `409 INVALID_TRANSITION`; `NEW → CONTACTED` → 200.
- Consent + child fields persist and return on the lead.
- Message logged (201) and returned via `GET /lead/:id/conversation`.
- Webhook idempotency: first `SUCCESS` (201), replay `DUPLICATE_EXTERNAL` (200), no duplicate lead.
- Group capacity: fill → group `FULL`; next add → `409 GROUP_FULL`.
- Auto-stage: trial `NO_SHOW` → lead `NO_RESPONSE` + follow-up task; trial `COMPLETED` → `TRIAL_COMPLETED` + `nextFollowUpDate`.
- All new error responses carry `requestId`.

Pending: user's manual browser smoke of the new UI; commit/merge (awaiting approval).
