# Plan 010: Meta Cloud API Cutover (WhatsApp go-live)

Status: active
Owner: Amit Ohana
Last updated: 2026-07-08

Takes the mock-validated WhatsApp stack (plans [004](004-2026-07-06-whatsapp-integration-phase-2.md)–[008](008-2026-07-07-automation-sequences.md), hardened by [009](009-2026-07-08-pre-cutover-hardening.md)) live on the real Meta Cloud API. The `CloudApiProvider`, signature verification, webhook, consent/window gating, and automation engine are already built and regression-tested — this plan is mostly **operational**: Meta-side setup, template approval, staged live validation behind a tunnel, then a small production deployment. Code changes are limited to deploy-readiness config and a template-status sync endpoint.

Decisions taken 2026-07-08: **two-stage rollout (tunnel → cloud deploy)**; Meta Business account exists and is **verified, no WABA yet**; a **new dedicated phone number** will be used (no migration of the existing INNOKIDS number); **Railway** is the production target; the owner's phone is the Stage 1–2 test recipient; a **marketing-consent dispatch gate** ships before any real customer messaging; template approval is **manually tracked** in the CRM this phase (see the two locked sections below).

---

## Goal

Real WhatsApp messages flowing both ways between parents and the CRM on INNOKIDS' own WABA and number, with the seeded automations sending approved Hebrew templates — validated first from the dev machine behind a tunnel, then running 24/7 on a small cloud host.

## Scope

**In scope:**
- **External Meta setup (guided checklist):** WABA creation under the verified Business account, new-number registration, developer app + WhatsApp product, permanent system-user token, app secret + verify token, webhook subscription, **payment method on the WABA** (template conversations are billed).
- **Template submission:** create the 12 seeded templates in Meta (Hebrew, `{{n}}` variables) under their seed names; reconcile categories with what Meta assigns; sync approval outcomes into the CRM.
- **Code — template status sync:** admin-only `PUT /api/automation/template/:id/status` (allowed: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`) so Meta approval outcomes can be recorded without Prisma Studio; status chip/action in the Automation page templates section; tests.
- **Code — deploy readiness:** env-driven `PORT` and CORS origin; backend statically serves `frontend/dist` with an SPA fallback (single-service production, relative `/api` keeps working); `GET /api/health` for host checks.
- **Stage 1 — live validation via tunnel:** `WHATSAPP_PROVIDER=cloud`, `AUTOMATION_ENABLED=false`, cloudflared/ngrok tunnel to the local backend; manual send/receive/status validation against a team test number.
- **Stage 2 — staged automation enable (still tunnel):** rules on one at a time starting with the trial ladder, exercised on an internal test lead.
- **Stage 3 — production deploy:** small cloud host with a persistent volume for SQLite, production env (`NODE_ENV=production`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, WhatsApp secrets), Meta webhook re-pointed to the production URL, tunnel retired, SQLite backup routine.

**Out of scope:**
- Group first-lesson fan-out (#7), rule-editing UI, per-trial `meetingUrl` insertion (unchanged deferrals).
- Automated Meta template create/submit via API (manual submission this round; the CRM stays the wording source of truth).
- Multi-number / multi-WABA routing; rich media; DB migration off SQLite.
- Meta/Instagram lead-ads adapter.

## Assumptions

- Plan 009 is merged: regression suite green in CI, template drift guard active (a live body edit flips `APPROVED → DRAFT` and halts that automation until re-approval — intended), production refuses the default admin.
- `CloudApiProvider` implements Graph API sends, `hub.verify_token` challenge, and `X-Hub-Signature-256` HMAC verification; raw body capture exists in `index.ts`.
- Seed marks templates `APPROVED` only under `WHATSAPP_PROVIDER=mock`; under `cloud` they seed as `DRAFT`, so nothing sends until Meta approval is recorded — the safe default.
- The 24h-window rule means all automated sends are template-only; session messages remain manual, inside the window.
- Israeli numbers normalize to `+972…`; the new number must be able to receive an SMS/voice OTP at registration and must not be attached to any consumer/Business-app WhatsApp.
- INNOKIDS scale (single team, hundreds of leads) fits SQLite-on-a-volume; the 5-min dispatch tick and webhook writes are light.

## Open Questions

> Resolved 2026-07-08 with the owner: **Railway** as production host; **marketing-consent gate: yes** (see mapping below); **owner's phone** as Stages 1–2 test recipient. Two additional design decisions were locked before execution and are recorded in the next two sections.

## Locked design 1: Automation-to-consent mapping

Dispatch-time rule: **every** send requires `whatsappConsent` (existing behavior); templates whose CRM `category` is `MARKETING` additionally require `marketingConsent`, else the row is `CANCELLED` with reason `NO_MARKETING_CONSENT`. The CRM `MessageTemplate.category` is the gating source of truth and is synced to Meta's final category during Phase B approval (Meta may reclassify; the status endpoint accepts a category update).

| # | Automation (trigger) | Template | Category | Consent required at dispatch | Rationale |
|---|---------------------|----------|----------|------------------------------|-----------|
| 1 | `LEAD_WELCOME` | `lead_welcome` | UTILITY | `whatsappConsent` | Acknowledges the parent's own inquiry — transactional |
| 2 | `LEAD_WELCOME_FOLLOWUP` | `lead_welcome_followup` | MARKETING | `whatsappConsent` + `marketingConsent` | "Still interested?" — re-engagement |
| 3 | `NO_RESPONSE_NUDGE` | `no_response_nudge` | MARKETING | `whatsappConsent` + `marketingConsent` | Re-engagement of an unresponsive lead |
| 4 | `NO_RESPONSE_NUDGE_2` | `no_response_nudge_2` | MARKETING | `whatsappConsent` + `marketingConsent` | Same |
| 5 | `NO_RESPONSE_NUDGE_3` | `no_response_nudge_3` | MARKETING | `whatsappConsent` + `marketingConsent` | Same ("last attempt") |
| 6 | `TRIAL_CONFIRMATION` | `trial_confirmation` | UTILITY | `whatsappConsent` | Confirmation of a booked appointment |
| 7 | `TRIAL_REMINDER` (−24h) | `trial_reminder` | UTILITY | `whatsappConsent` | Appointment reminder |
| 8 | `TRIAL_REMINDER_1H` (−1h) | `trial_reminder_1h` | UTILITY | `whatsappConsent` | Appointment reminder + join link |
| 9 | `TRIAL_JOIN_NOW` (−5m) | `trial_join_now` | UTILITY | `whatsappConsent` | Appointment start notice |
| 10 | `POST_TRIAL_FOLLOW_UP` | `post_trial_followup` | MARKETING | `whatsappConsent` + `marketingConsent` | Feedback ask with conversion intent |
| 11 | `TRIAL_NO_SHOW_RESCHEDULE` | `trial_no_show_reschedule` | UTILITY | `whatsappConsent` | Rescheduling a missed booked appointment |
| 12 | `STUDENT_WELCOME` | `student_welcome` | UTILITY | `whatsappConsent` | Enrollment confirmation |

Business consequence (accepted): leads default `marketingConsent=false`, so automations 2–5 and 10 hold (cancel at dispatch) until staff enables the lead's marketing-consent toggle. The seven UTILITY automations — including the full trial ladder — flow on WhatsApp consent alone.

## Locked design 2: Template approval management (manual this phase)

No API sync with Meta in Phase C — the CRM tracks approval manually; the admin is the bridge between WhatsApp Manager and the CRM. Automated status pull via the Graph API is a future slice.

States: `DRAFT` → `PENDING` → `APPROVED` | `REJECTED`

Operator flow:
1. Under `WHATSAPP_PROVIDER=cloud`, seeding creates every template `DRAFT` — nothing sends (dispatch requires `APPROVED`; anything else fails safe as `NO_APPROVED_TEMPLATE`).
2. Admin submits the template in WhatsApp Manager, then marks it `PENDING` in the CRM (status control on the Automation page).
3. Meta approves → admin sets `APPROVED`; the confirm dialog states the contract: *set APPROVED only when the CRM body exactly matches the Meta-approved wording*. Only then can the engine send it.
4. Meta rejects → admin sets `REJECTED`, edits the wording in the CRM editor, resubmits in Meta, marks `PENDING` again.
5. Automatic guard (extends plan 009): any body edit under `cloud` resets an `APPROVED` **or `PENDING`** template to `DRAFT` — a pending submission no longer matches edited text either.
6. If Meta later pauses/revokes a live template, the admin mirrors it manually (`REJECTED`/`DRAFT`); `AUTOMATION_ENABLED` and per-rule toggles cover the gap.

The status endpoint accepts any of the four values (admin judgment, no rigid transition map) plus an optional Meta-assigned `category`, keeping the consent gate aligned with Meta's final classification.

## Steps

### Phase A — Meta-side setup (external, no code; can start immediately)
1. In business.facebook.com (verified account): create the **WhatsApp Business Account (WABA)**.
2. Acquire the **new dedicated number**; keep it off consumer WhatsApp; register it to the WABA (SMS/voice OTP); set display name "INNOKIDS" (display-name review may apply).
3. In developers.facebook.com: create the **Meta app** (Business type), add the **WhatsApp product**, link the WABA. Record **Phone Number ID** and **WABA ID**.
4. Create a **system user** (admin) in Business Settings, grant it the app + WABA assets, and generate a **permanent access token** with `whatsapp_business_messaging` + `whatsapp_business_management`.
5. Note the **app secret**; choose a random **verify token** string.
6. Add a **payment method** to the WABA billing settings (business-initiated/template conversations are billed; service conversations have a free tier).
7. Fill `chore-app/backend/.env`: `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `AUTOMATION_ENABLED=false`. Nothing committed.

### Phase B — Template submission (external; parallel to Phase C code)
1. In WhatsApp Manager, create all 12 templates **with the exact seed names** (`lead_welcome`, `lead_welcome_followup`, `no_response_nudge`, `no_response_nudge_2`, `no_response_nudge_3`, `trial_confirmation`, `trial_reminder`, `trial_reminder_1h`, `trial_join_now`, `post_trial_followup`, `trial_no_show_reschedule`, `student_welcome`), language **he**, bodies copied from the CRM template editor, `{{n}}` variables matching the seeded variable counts. Replace the Zoom placeholder line in `trial_reminder_1h` with the real recurring link (then mirror the edit in the CRM editor so both stay identical).
2. Accept Meta's category verdicts (it may reclassify UTILITY↔MARKETING); record each template's final category + approval status.
3. As approvals land, set each template's CRM status via the new status endpoint (Phase C) — `APPROVED` only for exact-wording matches.

### Phase C — Code: consent gate + status sync + deploy readiness (branch `feat/meta-cutover`)
1. `src/services/automation.service.ts` — marketing-consent gate in `dispatchDue()`: after the template loads, `category === "MARKETING"` and `!lead.marketingConsent` → `CANCELLED NO_MARKETING_CONSENT` (per Locked design 1).
2. `src/services/template.service.ts` — add `updateTemplateStatus(id, { status, category? })` (status ∈ DRAFT/PENDING/APPROVED/REJECTED; category ∈ UTILITY/MARKETING/AUTHENTICATION when provided); extend the plan-009 body-edit guard so `PENDING` also resets to `DRAFT` under `cloud`.
3. `src/routes/automation.ts` — `PUT /api/automation/template/:id/status` (admin-guarded, 400 on bad values).
4. Automation page templates section — status becomes an admin control (DRAFT/PENDING/APPROVED/REJECTED, optional category) with a confirm dialog on APPROVED stating the exact-wording contract (per Locked design 2).
5. `src/index.ts` — `PORT` from env (default 4000); CORS origin from `CORS_ORIGIN` env (default `http://localhost:5173`); serve `../frontend/dist` statically with SPA fallback when the directory exists; add `GET /api/health` returning `{ ok: true, requestId }`.
6. Tests: marketing gate (MARKETING blocked without `marketingConsent`, sends with it, UTILITY unaffected); status endpoint validation + category sync; PENDING-edit reset; existing drift behavior unchanged. Health + static serving verified by boot smoke test.
7. Backend `tsc`, frontend build, full `npm test`, CI green on the PR; merge on explicit approval.

### Phase D — Stage 1: live messaging validation (tunnel, automation off)
1. Start a **cloudflared** tunnel (`cloudflared tunnel --url http://localhost:4000` for a quick URL, or a named tunnel for a stable one) → public HTTPS URL.
2. In the Meta app: configure the webhook to `<tunnel>/api/whatsapp/webhook` with the verify token; subscribe to `messages`. Meta's GET challenge must return 200 via the real `verifyChallenge`.
3. From the test phone (Open Q3), message the business number → verify: lead auto-created (`source WHATSAPP`), INBOUND message on the thread, window + consent set, admin notified.
4. Reply from the CRM inside the window (session message) → arrives on the phone; status callbacks flip SENT→DELIVERED→READ.
5. Send an approved template from the CRM (via the lead thread template path) → arrives; wrong-signature POST to the webhook → 401 (spot-check with a bogus signature).
6. Idempotency spot-check: Meta webhook retries must not duplicate messages (replay guarded by `ExternalRef`).

### Phase E — Stage 2: staged automation enable (tunnel)
1. Set all `AutomationRule.active=false` except the trial ladder (`TRIAL_CONFIRMATION`, `TRIAL_REMINDER`, `TRIAL_REMINDER_1H`, `TRIAL_JOIN_NOW`); set `AUTOMATION_ENABLED=true`; restart.
2. Schedule a trial for the test lead ~2h out → confirmation sends immediately; −1h and −5min reminders send on time; −24h reminder correctly guards/cancels (trial too soon).
3. Reschedule the trial → reminder `dueAt`s move; cancel → remaining rows CANCELLED.
4. Enable the remaining rules one at a time (welcome pair → no-response trio → post-trial → no-show → student welcome), exercising each once on the test lead; verify reply-stop by answering from the test phone mid-sequence.
5. Watch the Automation page outbox for FAILED rows throughout; delete the test lead + purge its rows when done.

### Phase F — Stage 3: production deploy
1. Provision the host (Open Q1): Node 22 service from the repo, persistent volume mounted for `DATABASE_URL=file:/data/prod.db`, build = backend `npm ci && npm run build` + frontend `npm ci && npm run build`, start = `node dist/index.js`.
2. Production env: `NODE_ENV=production`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (plan 009 gate), `JWT_SECRET` (fresh), `WEBHOOK_API_KEY`, all `WHATSAPP_*`, `AUTOMATION_ENABLED=false` initially, `CORS_ORIGIN` unset (same-origin static serving).
3. Run migrations on first boot (`prisma migrate deploy`); create the admin from env; log in and change nothing else — verify `/api/health`.
4. Re-point the Meta webhook to the production URL; re-verify; send one inbound + one template round-trip; then set `AUTOMATION_ENABLED=true` with the same rule set as Stage 2 and confirm one automated send.
5. Retire the tunnel. Set up a daily SQLite backup (host snapshot or a cron copying `/data/prod.db` to object storage).
6. Handoff notes in `CLAUDE.md`: production URL, env list, backup location, "how to pause everything" (kill switch + rule toggles).

## Validation

- Phase C: full test suite green locally + CI on the PR; health route responds; static serving verified with a production-mode local boot.
- Phase D: all six live-messaging checks pass against real Meta (challenge, inbound+autocreate, session reply, statuses, template send, 401 on bad signature).
- Phase E: every automation observed sending a real message at its offset at least once; reply-stop and reschedule verified live; zero unexplained FAILED rows.
- Phase F: production round-trip (inbound + template + one automated send) succeeds; server survives a restart with data intact (volume); backup file exists and restores.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Template rejections / recategorization (Hebrew marketing wording) | Automations blocked until re-approval | Submit early (Phase B is parallel); UTILITY-style factual wording where possible; statuses stay DRAFT in CRM until real approval |
| Webhook auto-disable (Meta disables after repeated delivery failures) | Inbound goes dark silently | Keep tunnel/host stable; health checks; re-subscribe procedure documented; Meta app alerts email on |
| Token leakage or expiry | Sends fail / account abuse | Permanent system-user token, least privilege, `.env`/host secrets only (never committed), rotation documented |
| Billing not configured | Template sends fail at free-tier edge | Payment method added in Phase A before any template send |
| Tunnel dies during Stages 1–2 | Missed inbound webhooks | Short-lived stages; named tunnel if >1 day; Meta retries transient failures |
| Automation misfire to a real parent during staging | Trust damage | `AUTOMATION_ENABLED=false` until Stage 2; rules enabled one-by-one against a test lead only; kill switch always available |
| Display-name / number review delays | Can't send from the brand name immediately | Number registration early in Phase A; validation can proceed while review completes |
| SQLite on a network volume misbehaving | Data corruption | Use the host's local persistent disk (not NFS); daily backups; INNOKIDS write volume is tiny |

## Rollout Order

1. Phase A — Meta setup (external, start now)
2. Phase B — Template submission (external, parallel)
3. Phase C — Code slice on `feat/meta-cutover` → PR → CI → merge on approval
4. Phase D — Stage 1 live messaging via tunnel (automation off)
5. **Checkpoint — live two-way messaging confirmed**
6. Phase E — Stage 2 staged automation enable (tunnel)
7. **Checkpoint — all automations observed live**
8. Phase F — Stage 3 production deploy + webhook re-point + backups
9. **Checkpoint — production round-trip + first automated send; tunnel retired**

## Rollback

- Any stage: `WHATSAPP_PROVIDER=mock` (or unset webhook subscription in Meta) returns the CRM to the fully-working mock state; core CRM never depends on WhatsApp being live.
- Automation: `AUTOMATION_ENABLED=false` stops all dispatch instantly; per-rule `active=false` for surgical stops.
- Phase C code is additive and PR-gated; revert the branch/PR to undo.
- Production deploy failure: Meta webhook re-points back to the tunnel in minutes; SQLite volume snapshot restores state.

## Execution Log

_(added as phases complete)_
