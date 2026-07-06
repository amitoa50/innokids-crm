# Plan 004: WhatsApp Integration (Phase 2 — Messaging + Automation)

Status: active
Owner: Amit Ohana
Last updated: 2026-07-06

---

## Goal

Turn the CRM into a real two-way parent-communication hub over WhatsApp, and add an automation engine that sends the right message at the right pipeline moment. Build the WhatsApp layer as a **provider-agnostic adapter** so INNOKIDS is never locked to one vendor, with **Meta Cloud API (direct)** as the recommended long-term default for ownership and cost. This phase sits on top of the hardened core from plan 003 (Conversation, Message, ExternalRef, consent) — WhatsApp attaches as an adapter, not a schema rewrite.

## Scope

**In scope (Phase 2a — Two-way messaging):**
- Provider-agnostic `WhatsAppProvider` interface + first concrete adapter (Meta Cloud API direct)
- Inbound webhook: verify challenge + signature check, parse inbound messages and delivery/read statuses
- Inbound auto-linking: match by normalized phone to an existing lead; create a new lead if unknown; open/append a WHATSAPP conversation; open the 24h service window
- Outbound session messages (within 24h window) from the CRM, consent-gated
- Outbound template messages (outside 24h window) via a template registry
- Delivery/read status updates on `Message` (SENT → DELIVERED → READ / FAILED)
- Idempotency via `ExternalRef` (provider message id ↔ our `Message`) for both inbound and status callbacks
- In-app inbox: extend the lead `תקשורת` panel into a real send/receive thread; a global inbox view
- Provider config/secrets via environment only (never committed)

**In scope (Phase 2b — Automation):**
- `MessageTemplate` registry and `AutomationRule` model (trigger → template → delay)
- Automation outbox (`ScheduledMessage`) dispatched by the existing node-cron loop
- Default rules for: trial reminder (before trial), post-trial follow-up, no-response nudge
- Consent + window rules enforced before every automated send; full audit in ActivityLog

**Out of scope (later phases):**
- Meta/Instagram lead-ads native adapter (separate plan)
- Google Calendar sync (separate plan)
- Rich media beyond images (documents, location, interactive list/button flows) — images only in this phase
- Visual automation builder UI (rules are seeded/config-driven in this phase)
- Multi-number / multi-WABA routing
- Test suite (repo has none, per `testing-rules.md`)

## Provider Analysis & Recommendation

Design is provider-agnostic; this compares the three candidates and picks the default concrete adapter.

| Dimension | Meta Cloud API (direct) | Twilio (BSP) | 360dialog (BSP) |
|-----------|-------------------------|--------------|-----------------|
| Setup complexity | Higher — Meta Business verification, WABA + number registration, webhook + token, template approval | Lowest — instant sandbox, managed onboarding, great docs | Medium — official BSP onboarding; they provision the WABA for you |
| Cost structure | Meta conversation-based pricing only, **no per-message markup**; service-window messages cheap/free | Meta pricing **+ Twilio per-message markup** + monthly number fee | **Flat monthly SaaS fee, no per-message markup**; you still pay Meta conversation fees |
| Fit for Israeli education SMB | Strong — Hebrew/RTL fully supported, direct control of the parent number | Strong for speed, but markup compounds at parent-messaging volume | Strong — predictable flat cost suits steady seasonal SMB volume |
| Long-term ownership of the CRM OS | **Best** — you own the WABA, number, and data with no intermediary | Weaker — Twilio sits between you and Meta; number typically lives on Twilio | Medium — BSP holds the API relationship, but the WABA is yours and portable |
| Migration flexibility | N/A (already direct; the end state everything migrates toward) | Migrating off = number/WABA migration effort | Number portable between BSPs and to Cloud API |

**Recommendation:** Build the `WhatsAppProvider` interface now and ship the first adapter on **Meta Cloud API direct** — it maximizes ownership and avoids per-message markups, matching the "own the OS" goal, and our webhook + `ExternalRef` design already fits it. Keep **Twilio** documented as a fast-prototype fallback (useful for testing before Meta Business verification completes). Because everything speaks through the interface, switching providers later is a new adapter class + env change, not a rewrite. This directly answers Open Question 2.

## Assumptions

- Plan 003 core is merged/available: `Conversation`, `Message`, `ExternalRef`, consent fields, pipeline engine.
- SQLite + Prisma remain; enum-like fields stay `String` with documented values (per `database-rules.md`).
- Express v5 native async errors; PrismaClient singleton; error shape `{ error: { code, message, details? }, requestId }`.
- No trailing semicolons; singular route/service naming; Hebrew RTL UI; `sonner`/`lucide-react`.
- All provider secrets live in `.env` only; `.env.example` gets placeholders; nothing secret is committed (per `AGENTS.md` Security).
- WhatsApp platform rules apply: free-form (session) messages only within 24h of the last inbound; outside that window requires an approved template.
- Inbound messages are user-initiated and open a 24h service window; we treat inbound as establishing a WhatsApp service opt-in.
- INNOKIDS will complete the external Meta setup (Business verification, WABA, number, template approval) — tracked as a readiness dependency, not code.

## Open Questions

> **Resolved 2026-07-06 — approved "all recommended."**
> 1: branch from `feat/crm-hardening` (003 stays unmerged). 2: provider-agnostic, Meta Cloud API default. 3: auto-create unknown inbound leads + notify. 4: inbound implies service-window consent (marketing stays explicit). 5: ship the three default automation rules. 6: automated send with no approved template fails + flags, never free-form. 7: split 2a/2b into two checkpoints.

> Answer inline; recommended answers marked **(rec)**.

1. **Base branch.** New branch `feat/whatsapp` from `main` (after 003 merges) or from `feat/crm-hardening`?
   - **(rec)** From `feat/crm-hardening` if 003 is not yet merged, so this builds on the hardened core; rebase onto `main` once 003 lands.

2. **Provider default.** Confirm provider-agnostic interface with **Meta Cloud API direct** as the first/default adapter and Twilio as documented fallback (see Provider Analysis).
   - **(rec)** Yes.

3. **Unknown inbound numbers.** When a WhatsApp message arrives from a number with no matching lead, auto-create a lead (`source = WHATSAPP`, status `NEW`) or drop into a review queue?
   - **(rec)** Auto-create the lead and notify admins — never lose an inbound parent. Log raw payload for audit.

4. **Inbound implies consent.** Set `whatsappConsent = true` when a parent messages us first (they opened the service window)?
   - **(rec)** Yes for service-window replies; keep `marketingConsent` separate and still explicit for promotional templates.

5. **Automation trigger set (Phase 2b).** Confirm the initial default rules: (a) trial reminder X hours before `scheduledAt`; (b) post-trial follow-up after a completed trial; (c) no-response nudge when a lead ages to `NO_RESPONSE`.
   - **(rec)** Ship these three, all consent- and window-gated, all overridable per rule. Timing constants configurable (reuse the pattern from `lib/pipeline.ts`).

6. **Automated send outside the 24h window.** Automated messages will usually fall outside the session window, so they must be approved templates. Block (and flag) an automated send if no approved template exists?
   - **(rec)** Yes — never attempt a free-form automated send; mark the `ScheduledMessage` `FAILED` with reason `NO_APPROVED_TEMPLATE` and notify an admin.

7. **Rollout split.** Deliver 2a (messaging) and 2b (automation) as two review checkpoints within this one plan/branch?
   - **(rec)** Yes — messaging must be solid before automation rides on it.

## Steps

### Step 1: Documentation updates (first, no code risk)
- `agent-files/.doc/glossary.md` — add `whatsapp-provider`, `message-template`, `automation-rule`, `scheduled-message`, `service-window`.
- `agent-files/.doc/architecture.md` — add the WhatsApp adapter (inbound webhook + outbound sender + status callbacks), the automation engine + outbox, and provider-agnostic boundary; Change Log entry dated to execution day.
- `agent-files/.doc/product-definition.md` — move WhatsApp from "Integration Roadmap" into active Phase 2 scope; note automation.
- `agent-files/.rule/database-rules.md` — add `MessageTemplate`, `AutomationRule`, `ScheduledMessage` to Core Models; note provider secrets live in env, not DB.
- `CLAUDE.md` (root) — add WhatsApp routes, new entities, env vars, and window/consent notes.

### Step 2: Branch setup
- Create `feat/whatsapp` per Open Question 1 (`versioning-rules.md`).

### Step 3: Environment + config
- `chore-app/backend/.env.example` — add placeholders: `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_PHONE_NUMBER_ID=`, `WHATSAPP_ACCESS_TOKEN=`, `WHATSAPP_VERIFY_TOKEN=`, `WHATSAPP_APP_SECRET=`, `WHATSAPP_API_VERSION=`.
- `chore-app/backend/.env` — set real dev values locally (never committed).
- `chore-app/backend/src/lib/whatsappConfig.ts` — typed loader that reads env and selects the provider; fails fast if enabled but misconfigured.

### Step 4: Database schema (additive migration `whatsapp-phase-2`)
- **`MessageTemplate`** — `id`, `name` (unique), `language` (default `he`), `category` (UTILITY, MARKETING, AUTHENTICATION), `body`, `variables` (JSON), `status` (DRAFT, PENDING, APPROVED, REJECTED), timestamps.
- **`AutomationRule`** — `id`, `name`, `triggerEvent` (TRIAL_REMINDER, POST_TRIAL_FOLLOW_UP, NO_RESPONSE_NUDGE), `templateName`, `channel` (default WHATSAPP), `offsetMinutes` (e.g. -1440 for a day before), `active` (default true), timestamps.
- **`ScheduledMessage`** (automation outbox) — `id`, `leadId`, `channel`, `templateName`, `variables` (JSON), `dueAt`, `status` (PENDING, SENT, CANCELLED, FAILED), `failureReason?`, `messageId?` (FK→Message once sent), timestamps; `@@index([status, dueAt])`.
- **`Lead` — add** `whatsappWindowExpiresAt DateTime?` (24h service window tracking).
- Run `npx prisma migrate dev --name whatsapp-phase-2` + `npx prisma generate`.

### Step 5: Provider-agnostic adapter (Phase 2a)
- `chore-app/backend/src/services/whatsapp/provider.ts` — the `WhatsAppProvider` interface: `sendSessionMessage(toPhone, body)`, `sendTemplate(toPhone, templateName, language, variables)`, `verifyWebhook(req)`, `parseWebhook(payload)` → normalized `{ inboundMessages[], statusUpdates[] }`.
- `chore-app/backend/src/services/whatsapp/cloudApi.provider.ts` — Meta Cloud API implementation: Graph API send calls; `X-Hub-Signature-256` HMAC + `hub.verify_token` challenge; payload parsing.
- `chore-app/backend/src/services/whatsapp/index.ts` — factory returning the configured provider (`cloud` now; `twilio`/`360dialog` documented stubs throwing `NOT_IMPLEMENTED`).

### Step 6: Inbound webhook + outbound send (Phase 2a)
- `chore-app/backend/src/routes/whatsapp.ts`:
  - `GET /api/whatsapp/webhook` — verify challenge (provider-specific).
  - `POST /api/whatsapp/webhook` — validate signature; for each inbound message: find-or-create lead by normalized phone (Open Q3), `getOrCreateConversation` (WHATSAPP), `logMessage` (INBOUND, status RECEIVED), set `whatsappWindowExpiresAt = now + 24h`, set `whatsappConsent = true` (Open Q4), `linkExternalId` (system WHATSAPP, provider msg id) for idempotency, notify assigned staff; for each status update: map to `Message.status` via `ExternalRef` lookup.
- `chore-app/backend/src/services/whatsapp/send.service.ts` — `sendWhatsApp(leadId, { body | template }, sentById)`: consent check → window check (session vs template) → provider call → `logMessage` (OUTBOUND, status PENDING) → `linkExternalId` with returned provider id. Returns domain errors (`NO_CONSENT`, `WINDOW_CLOSED_NO_TEMPLATE`) mapped to `409/422`.
- Extend `POST /api/lead/:id/message`: when `channel = WHATSAPP` and `direction = OUTBOUND`, route through `send.service` (real send) instead of log-only; other channels stay log-only.

### Step 7: Frontend inbox (Phase 2a)
- Extend the lead `תקשורת` panel: real send box (session vs template picker when window closed), live delivery/read ticks, consent/window banners; surface `NO_CONSENT` / `WINDOW_CLOSED_NO_TEMPLATE` via `sonner`.
- `chore-app/frontend/src/pages/Inbox.tsx` + nav item — global list of open WHATSAPP conversations with unread indicators; poll like `NotificationBell`.
- Types: `MessageTemplate`, `AutomationRule`, `ScheduledMessage`; extend `Lead` (`whatsappWindowExpiresAt`).
- `styles/cmps/conversation.css` — add status-tick + window-banner styles (CSS variables, per `style-rules.md`).

### Step 8: Template registry (spans 2a/2b)
- `chore-app/backend/src/services/messageTemplate.service.ts` + `routes/messageTemplate.ts` — CRUD (admin only); mirror approved templates from the provider; validate variables before send.
- Minimal admin UI to list/register templates and view approval status.

### Step 9: Automation engine (Phase 2b)
- `chore-app/backend/src/services/automation.service.ts` — on domain events (trial scheduled/completed, lead → NO_RESPONSE), evaluate active `AutomationRule`s and enqueue `ScheduledMessage` rows at `dueAt = eventTime + offsetMinutes`.
- Hook enqueue calls into `trialLesson.service` and `lead.service` `setLeadStatus` (system path), guarded so manual actions are unaffected.
- Extend node-cron in `index.ts`: dispatch due `PENDING` `ScheduledMessage`s → `send.service.sendTemplate`; on success mark SENT + link the created `Message`; on missing approved template mark FAILED `NO_APPROVED_TEMPLATE` + notify admin (Open Q6). Idempotent per row.
- Seed default `AutomationRule`s (Open Q5); all sends consent- and window-gated and written to `ActivityLog`.

### Step 10: Validation (see Validation section)

## Validation

Manual + type/build (no automated suite, per `testing-rules.md`). Use a provider sandbox / test number before production.

**Phase 2a:**
1. `prisma generate` + migrate clean; backend/frontend `tsc` + `vite build` pass.
2. Webhook verify challenge returns the echo token; a bad signature is rejected `401`.
3. Inbound from a known number → message appears on the lead thread, window set, consent set; from an unknown number → new lead created + admin notified.
4. Inbound replay (same provider message id) is idempotent (no duplicate `Message`).
5. Outbound session message within window sends and logs; status webhook flips PENDING → DELIVERED → READ.
6. Outbound with no consent → `409 NO_CONSENT`; outside window with no template → `422 WINDOW_CLOSED_NO_TEMPLATE`; both carry `requestId`.

**Phase 2b:**
7. Scheduling a trial enqueues a reminder `ScheduledMessage` at the right `dueAt`; cron dispatches it once (idempotent).
8. Completing a trial enqueues the post-trial follow-up; a lead aging to `NO_RESPONSE` enqueues the nudge.
9. Automated send with no approved template → `ScheduledMessage` FAILED `NO_APPROVED_TEMPLATE` + admin notified; nothing sent.
10. Every automated send is consent/window-gated and appears in `ActivityLog`.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Meta Business verification / template approval delays | Blocks production go-live even with code ready | Build against sandbox; treat external setup as a tracked readiness dependency; Twilio fallback for early testing |
| Provider lock-in creeping into core code | Hard to switch vendors later | All provider calls behind `WhatsAppProvider`; no provider types leak past the adapter |
| Sending outside the 24h window without a template | Failed sends, policy violations | Explicit window check + template-only automated sends; block + flag otherwise |
| Messaging parents without consent | Compliance/trust damage | Hard consent gate on every outbound; inbound-implied consent scoped to service window only |
| Duplicate inbound/status processing | Corrupted thread/status | `ExternalRef` idempotency on provider message id for messages and status callbacks |
| Secrets committed accidentally | Security breach | Secrets in `.env` only; `.env.example` placeholders; verify `.env` stays gitignored before commit |
| Automation storm (misconfigured rule) | Parents spammed | Per-rule `active` flag, one enqueue per event, cron dispatch caps, dry-run log before enabling |
| SQLite under webhook + cron write load | Contention on a busy day | Acceptable at INNOKIDS scale; keep webhook handlers fast, offload sends to the cron outbox |

## Rollout Order

1. Step 1 — Docs
2. Step 2 — Branch `feat/whatsapp`
3. Step 3 — Env + config
4. Step 4 — Schema + migration (additive)
5. Step 5 — Provider interface + Cloud API adapter
6. Step 6 — Inbound webhook + outbound send
7. Step 7 — Frontend inbox
8. Step 8 — Template registry
9. **Checkpoint 2a** — messaging validated end-to-end on sandbox (Validation 1–6)
10. Step 9 — Automation engine
11. **Checkpoint 2b** — automation validated (Validation 7–10)

## External Setup Readiness (INNOKIDS action — parallel to coding)

Code can be built and validated locally against a mock/sandbox provider, but production go-live needs these done on your side. This is the gating dependency:

1. **Meta Business Account** — create/verify at business.facebook.com (Business Verification can take days).
2. **WhatsApp Business Account (WABA)** — create inside Meta Business; accept WhatsApp terms.
3. **Phone number** — a number NOT already on a personal/consumer WhatsApp (or fully migrated off it); register it to the WABA and complete verification.
4. **Meta App (Developer)** — create an app at developers.facebook.com, add the WhatsApp product; note `Phone Number ID` and `WhatsApp Business Account ID`.
5. **Access token** — start with a temporary token for sandbox; set up a permanent/system-user token for production.
6. **App secret + verify token** — for webhook `X-Hub-Signature-256` validation and the `hub.verify_token` challenge.
7. **Webhook URL** — a public HTTPS endpoint reachable by Meta (use a tunnel like ngrok/cloudflared for dev) pointing at `/api/whatsapp/webhook`.
8. **Message templates** — draft + submit Hebrew templates for the three automation rules; approval is required before out-of-window/automated sends work.

Provide items 3–6 into `.env` when ready; nothing here gets committed.

## Rollback

- All work on `feat/whatsapp`; `main` untouched; merge only on explicit approval (`versioning-rules.md`).
- Additive migration: revert schema + drop the `whatsapp-phase-2` migration, or reset the disposable `dev.db`.
- Feature can be disabled at runtime via `WHATSAPP_PROVIDER` unset / disabled flag — inbound webhook and automated sends no-op, core CRM unaffected.
- Automation is behind `AutomationRule.active`; flip all rules off to halt sends without a deploy.

## Execution Log

### 2026-07-06 — Phase 2a (messaging) complete, validated on mock provider
Branch `feat/whatsapp` (from `feat/crm-hardening`). Not committed to `main`, not merged.

- Schema: added `MessageTemplate`, `AutomationRule`, `ScheduledMessage`; `Lead.whatsappWindowExpiresAt`. Migration `whatsapp-phase-2` applied (additive); client regenerated.
- Config: `.env.example` + `.env` WhatsApp vars; `lib/whatsappConfig.ts`. Local dev uses `WHATSAPP_PROVIDER=mock`.
- Adapter: `WhatsAppProvider` interface + `cloudApi.provider` (Meta) + `mock.provider` + factory. Raw-body capture added for signature verification.
- Messaging: `routes/whatsapp.ts` (verify + inbound + status), `whatsapp/inbound.service` (auto-link/create lead, open window, idempotency), `whatsapp/send.service` (consent + window gating). `POST /lead/:id/message` now sends real WhatsApp for WHATSAPP+OUTBOUND.
- Frontend: types extended; LeadDetails communication panel gains window/consent banner, delivery-status ticks, and consent/window error toasts.
- Docs: glossary, architecture, database-rules, CLAUDE.md updated.

Validation (mock provider, all pass): verify challenge (200) / wrong token (403); inbound from new number creates lead (source WHATSAPP, consent, window) + logs INBOUND; replay idempotent (no dup); outbound send logs OUTBOUND + links external id; status callback flips SENT→DELIVERED→READ; `NO_CONSENT` (409); `WINDOW_CLOSED_NO_TEMPLATE` (422); all errors carry `requestId`. Backend `tsc`, frontend `tsc` + `vite build`: 0 errors.

**Remaining (Phase 2b + polish):** automation engine (MessageTemplate service/routes, AutomationRule seed, event hooks, cron dispatch of ScheduledMessage), global Inbox page, template registry admin UI, live Meta Cloud API cutover (needs external credentials).
