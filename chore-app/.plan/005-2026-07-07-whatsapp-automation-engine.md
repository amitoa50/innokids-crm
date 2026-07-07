# Plan 005: WhatsApp Automation Engine (Phase 2b)

Status: draft
Owner: Amit Ohana
Last updated: 2026-07-07

Elaborates and executes the Phase 2b portion of [plan 004](004-2026-07-06-whatsapp-integration-phase-2.md) (Step 9). Plan 004 stays the record for Phase 2a (messaging, done); this plan is the detailed automation-engine design derived from a business-workflow mapping of the real INNOKIDS sales process.

---

## Goal

Add a business-driven WhatsApp automation engine on top of the validated Phase 2a messaging layer: the right template message is enqueued on the right pipeline event and dispatched at the right time, always consent- and window-gated, fully audited. The engine is generic but is designed around seven real INNOKIDS automations (six built now, one deferred), not as an abstract automation builder.

## Scope

**In scope:**
- Event-driven enqueue hooks for six automations (see the Automation Map) into `lead.service` and `trialLesson.service` and the daily cron aging loop.
- An idempotent automation outbox (`ScheduledMessage`) dispatched by a new 5-minute `node-cron` tick, separate from the untouched daily 00:00 job.
- Dispatch-time re-check of stop conditions, cancel/supersede handling (trial reschedule/cancel, conversion, close), and admin notification on failure.
- Idempotent startup seed of six `AutomationRule` rows and their `MessageTemplate` rows (Hebrew; seeded `APPROVED` in mock/dev only).
- Additive migration extending `ScheduledMessage` (dedup + trigger-entity + transient status) and the `AutomationRule.triggerEvent` documented value set.
- Config flag `AUTOMATION_ENABLED` gating the dispatch tick.
- Deliver **automation #3 (trial confirmation + reminder) as the one-rule proof slice first**, validate end-to-end on the mock provider, then expand to the remaining five.

**Out of scope (later):**
- Automation #7 (group first-lesson fan-out) — needs a scan-based enqueuer and per-student batch sends; reserved.
- Multi-step sequences (no-response is a single nudge in v1; sequence state deferred).
- Template-registry admin UI and any new HTTP route (engine is backend-only this slice).
- Live Meta Cloud API cutover (external readiness dependency from plan 004).
- Automated test suite (repo has none, per `testing-rules.md`) — manual validation.

## Automation Map (business source of truth)

All seven are business-initiated and fire when the 24h service window is almost always closed, so every one is **template-based**. Timing values are the approved defaults.

| # | Trigger | Timing | Template | Stop / precedence | v1 |
|---|---------|--------|----------|-------------------|----|
| 1 | Lead created, `action = SUCCESS`, `source != WHATSAPP` | +2 min | `lead_welcome` | skip if a prior outbound WhatsApp exists; skip if `CLOSED` | yes |
| 2 | Lead ages into `NO_RESPONSE` (aging path only) | +0 | `no_response_nudge` | single nudge; skip if not still `NO_RESPONSE` at dispatch | yes |
| 3 | `TrialLesson` created (`SCHEDULED`) | confirm +0; reminder −1440 min | `trial_confirmation`, `trial_reminder` | reschedule updates reminder `dueAt` in place; cancel cancels pending; skip if trial not `SCHEDULED` at dispatch | yes (proof) |
| 4 | `TrialLesson` → `COMPLETED` | +1440 min | `post_trial_followup` | skip if lead `CONVERTED`/`CLOSED` | yes |
| 5 | `TrialLesson` → `NO_SHOW` | +180 min | `trial_no_show_reschedule` | owns post-no-show outreach and suppresses #2; skip if a newer `SCHEDULED` trial exists | yes |
| 6 | `convertLead` succeeds | +0 | `student_welcome` | fires once per conversion | yes |
| 7 | `Group.startDate` approaching (scan) | −2880 min | `group_first_lesson` | active students only; batch fan-out | deferred |

Precedence rule B is structural: the no-show handler enqueues #5 and the aging loop enqueues #2, so a no-show never triggers the generic nudge.

## Assumptions

- Phase 2a is available on `feat/whatsapp`: `WhatsAppProvider` + mock adapter, `send.service` (consent + window + template gating), inbound webhook, `Conversation`/`Message`/`ExternalRef`, consent fields, `Lead.whatsappWindowExpiresAt`.
- `MessageTemplate`, `AutomationRule`, `ScheduledMessage` models already exist from the plan 004 migration; this plan only adds columns/values.
- SQLite + Prisma; enum-like fields stay `String` with documented values (`database-rules.md`). PrismaClient singleton. Express v5 native async errors. No trailing semicolons. Singular naming. Error shape `{ error: { code, message, details? }, requestId }`.
- All provider secrets stay in `.env`; nothing seeded is secret; seeded `APPROVED` templates are a mock/dev convenience only — real Meta template approval is an external readiness item and is never faked in production.
- `WHATSAPP_PROVIDER=mock` for local validation; no Meta credentials required to build or validate this slice.

## Open Questions

> Resolved 2026-07-07 during brainstorming (approved: engine mapping, "all recommended", Approach 1, and the design).

1. **Engine approach.** Event-enqueue + outbox dispatched by a frequent cron tick vs. daily-cron scan vs. synchronous send. — **Resolved: Approach 1** (event enqueue + outbox + **5-minute** dispatch tick). Only approach that honors reminder timing and reuses the schema.
2. **Timing defaults (A).** — **Resolved: accept the mapped defaults** (+2 min / +0 / −1440 / +1440 / +180 / +0 / −2880).
3. **No-show vs no-response precedence (B).** — **Resolved: #5 owns post-no-show outreach; #2 only for aged-out leads with no trial.**
4. **Sequences (C).** — **Resolved: single no-response nudge in v1; multi-step sequences deferred.**
5. **Group fan-out (D).** — **Resolved: #7 deferred to a later slice.**
6. **Proof rule.** — **Resolved: automation #3** (richest single automation: immediate + future-dated dispatch, reschedule, cancel, dispatch-time guard).
7. **Surface.** — **Resolved: backend-only this slice** — no admin UI/route; automated sends surface through the existing `תקשורת` thread and activity timeline.

## Steps

### Step 1: Documentation updates (first, no code risk)
- `agent-files/.doc/architecture.md` — describe the automation engine (event enqueue → outbox → 5-min dispatch → template send), dispatch-time guard/cancel model, and the second cron; Change Log entry dated 2026-07-07.
- `agent-files/.doc/glossary.md` — confirm `automation-rule`, `scheduled-message`, `message-template`, `service-window` cover the engine; add `automation-outbox` and `dispatch-tick` if used broadly.
- `agent-files/.rule/database-rules.md` — note the `ScheduledMessage` additions and the `SENDING` transient status.
- `CLAUDE.md` (root) — add the automation engine notes, the `AUTOMATION_ENABLED` env var, and the 5-min cron.

### Step 2: Environment + config
- `chore-app/backend/.env.example` — add `AUTOMATION_ENABLED=true`.
- `chore-app/backend/.env` — set locally (never committed).

### Step 3: Schema (additive migration `automation-engine`)
- `ScheduledMessage` — add `dedupeKey String? @unique`; `entityType String?`; `entityId Int?`; `@@index([entityType, entityId])`; document `SENDING` in the `status` value comment (`PENDING`, `SENDING`, `SENT`, `FAILED`, `CANCELLED`).
- `AutomationRule.triggerEvent` — extend documented values to: `LEAD_WELCOME`, `NO_RESPONSE_NUDGE`, `TRIAL_CONFIRMATION`, `TRIAL_REMINDER`, `POST_TRIAL_FOLLOW_UP`, `TRIAL_NO_SHOW_RESCHEDULE`, `STUDENT_WELCOME` (`GROUP_FIRST_LESSON` reserved).
- Run `npx prisma migrate dev --name automation-engine` + `npx prisma generate` (stop the dev server first to avoid the Windows engine-lock EPERM).

### Step 4: Registry (pure, code-side)
- `chore-app/backend/src/services/automation/registry.ts` — map keyed by `triggerEvent` → `{ templateName, offsetMinutes, entityType, resolveVariables(ctx), guard(entity) }`. Holds per-automation variable resolution and dispatch-time stop conditions. No I/O.

### Step 5: Engine service
- `chore-app/backend/src/services/automation.service.ts`:
  - `enqueue(triggerEvent, ctx)` — find active rule, compute `dueAt = baseTime + offsetMinutes` where `baseTime` is the event time for immediate/after-event automations and the trial `scheduledAt` for the reminder (the registry declares which base each event uses), build `dedupeKey = "<event>:<entityType>:<entityId>"`, resolve variables, upsert on `dedupeKey` (create if absent; update `dueAt` if `PENDING`; never resurrect terminal rows).
  - `cancelForEntity(entityType, entityId, reason)` — set matching `PENDING` rows to `CANCELLED` with `failureReason`.
  - `dispatchDue()` — claim batch (`updateMany PENDING & dueAt<=now → SENDING`, cap ~50); per row load lead/rule/template/entity, run `guard` + consent + template-approved checks; on pass call `send.service.sendWhatsApp(leadId, { templateName, variables }, null)`, set `messageId` + `SENT` + `ActivityLog` `WHATSAPP_AUTO_SENT`; on guard fail → `CANCELLED` + reason; on missing/unapproved template → `FAILED NO_APPROVED_TEMPLATE` + admin notify; on send failure → `FAILED` + reason + admin notify (domain errors not retried, per `error-handling-rules.md`).

### Step 6: Seed
- `chore-app/backend/src/lib/automationSeed.ts` — idempotent (by unique `name`) seed of six `MessageTemplate`s (Hebrew body, `{{n}}` variables, `status APPROVED` in mock) and six `AutomationRule`s (`active: true`, correct `offsetMinutes`). Call from `index.ts` alongside `seedAdmin()`.

### Step 7: Event hooks
- `lead.service.ts` — `createLead` (new `SUCCESS`, `source != WHATSAPP`) → `enqueue("LEAD_WELCOME", …)`; `convertLead` success → `enqueue("STUDENT_WELCOME", …)`.
- `trialLesson.service.ts` — create → `enqueue("TRIAL_CONFIRMATION")` + `enqueue("TRIAL_REMINDER")`; reschedule → re-enqueue (updates reminder `dueAt` in place); cancel → `cancelForEntity`; `COMPLETED` → `enqueue("POST_TRIAL_FOLLOW_UP")`; `NO_SHOW` → `enqueue("TRIAL_NO_SHOW_RESCHEDULE")`.
- `index.ts` daily aging loop — after `setLeadStatus(… "NO_RESPONSE")`, `enqueue("NO_RESPONSE_NUDGE")`.

### Step 8: Dispatch tick
- `index.ts` — add `cron.schedule("*/5 * * * *", …)` calling `automation.service.dispatchDue()`, wrapped in try/catch and gated by `AUTOMATION_ENABLED`. Daily 00:00 job untouched.

### Step 9: Proof + expansion
- Validate automation #3 end-to-end on mock (Validation 1–8), then confirm #1/#2/#4/#5/#6 enqueue + dispatch. Checkpoint before any consideration of #7 or a template-admin UI.

## Validation

Manual + type/build (no automated suite, per `testing-rules.md`); freeze/override time where behavior depends on it.

1. `prisma migrate` + `generate` clean; backend `tsc` and frontend `tsc` + `vite build` pass.
2. Scheduling a trial creates exactly two `ScheduledMessage` rows with correct `dueAt` (confirmation ≈ now, reminder = `scheduledAt − 24h`).
3. Forcing the reminder due → `dispatchDue()` sends one template `Message` (`SENT`), writes `ActivityLog`, links `messageId`.
4. Running `dispatchDue()` twice → a single send (SENDING claim + `messageId` unique).
5. Reschedule → reminder `dueAt` updated in place (no duplicate); cancel trial → pending rows `CANCELLED`.
6. Marking the trial `COMPLETED` before the reminder is due → reminder `CANCELLED` (guard reason), nothing sent.
7. Template set to `DRAFT` → `FAILED NO_APPROVED_TEMPLATE` + admin notified; nothing sent.
8. `whatsappConsent=false` before dispatch → `CANCELLED CONSENT_REVOKED`.
9. Expansion: creating a lead (non-WhatsApp source) enqueues + dispatches `LEAD_WELCOME`; aging a lead to `NO_RESPONSE` enqueues the nudge; completing a trial enqueues the follow-up; a no-show enqueues the reschedule (and not the nudge); converting enqueues the welcome.
10. Every automated send is consent/window/template-gated and appears in `ActivityLog`.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Automation storm (misconfigured rule) | Parents spammed | Per-rule `active`; idempotent `dedupeKey` enqueue; dispatch batch cap; `AUTOMATION_ENABLED` kill switch |
| Overlapping 5-min ticks double-send | Duplicate messages | `SENDING` claim via `updateMany`; `messageId` unique backstop |
| Reminder timing wrong across timezones | Early/late reminders | Store `dueAt` in UTC; use `Group.timezone`/trial time consistently |
| Seeded `APPROVED` templates leak to prod | Policy violation | Seed `APPROVED` only when `WHATSAPP_PROVIDER=mock`; real approval external |
| Windows Prisma engine lock on migrate | Blocked migration | Stop the dev server before `migrate`/`generate` |
| Sending outside window without a template | Failed sends / policy | `send.service` template-only enforcement + dispatch-time template-approved guard |
| SQLite write contention (cron + webhook) | Slow days | Acceptable at scale; keep dispatch batches small and fast |

## Rollout Order

1. Step 1 — Docs
2. Step 2 — Env + config (`AUTOMATION_ENABLED`)
3. Step 3 — Schema + migration (additive)
4. Step 4 — Registry
5. Step 5 — Engine service
6. Step 6 — Seed
7. Step 7 — Event hooks
8. Step 8 — 5-min dispatch tick
9. **Checkpoint — automation #3 proof validated on mock (Validation 1–8)**
10. Step 9 — Expand to #1/#2/#4/#5/#6 (Validation 9–10)

## Rollback

- All work on `feat/whatsapp`; `main` untouched; commit/merge only on explicit approval (`versioning-rules.md`).
- Additive migration: revert the schema additions + drop the `automation-engine` migration, or reset the disposable `dev.db`.
- Runtime kill switch: `AUTOMATION_ENABLED` unset → dispatch tick no-ops; `AutomationRule.active=false` halts individual rules with no deploy. Enqueue hooks are guarded so manual actions are unaffected when the engine is dormant.
