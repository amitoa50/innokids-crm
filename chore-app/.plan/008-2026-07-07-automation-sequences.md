# Plan 008: Automation Sequences + Reply-Aware Stops

Status: done
Owner: Amit Ohana
Last updated: 2026-07-07

Revises the automation **behavior** defined in [plan 005](005-2026-07-07-whatsapp-automation-engine.md) for automations #1–#4, to match the real INNOKIDS process: multi-step sequences that stop when the parent replies or progresses, an expanded trial reminder ladder, and a faster post-trial follow-up. The engine architecture from 005 is unchanged — this is additive (more rules/templates/guards + a reply-detection helper). Builds on the monitoring UI ([006](006-2026-07-07-automation-monitoring-ui.md)) and template editor ([007](007-2026-07-07-automation-template-editor.md)); every new template is editable there.

---

## Goal

Turn today's fire-once automations into the real business flows:
- **New lead** → opener + one 24h follow-up if no reply (stop on reply/progress).
- **No-response** → a true 3-step sequence at 0 / +24h / +48h (stop on reply/progress).
- **Trial scheduled** → a 4-message ladder: confirm + reminders at −24h, −1h (Zoom link), −5min ("join now").
- **Post-trial** → a single follow-up at **+1h** (was +24h).

No-show (#5) and student welcome (#6) are unchanged.

## Scope

**In scope (all additive; no schema/migration change):**
- New seeded `AutomationRule`s + `MessageTemplate`s for the added steps; sync `offsetMinutes`/`templateName` on existing rules from the seed (so timing changes deploy without a DB reset), preserving each rule's `active` flag.
- New `registry.ts` entries (variable resolution + dispatch-time guards) for the added steps.
- A **reply-detection helper** — "has the parent sent an inbound WhatsApp message since time T" — used by the #1/#2 follow-up guards.
- Hook updates in `lead.service` (welcome follow-up), the daily aging loop (no-response steps 2–3), and `trialLesson.service` (two new reminders + reschedule handling). Post-trial timing changes via the rule offset only.

**Out of scope:**
- Any change to the outbox model, dispatch loop, or 5-minute cadence.
- Automation-**rule** editing UI (still deferred); offsets stay code/seed-driven for now.
- Auto-inserting each trial's `meetingUrl` (Zoom link stays editable template text this round).
- Changes to #5 (no-show) and #6 (student welcome).
- New DB columns or migrations.

## New / changed automation spec

Base = the time the offset is measured from. `now` = event time; `trial` = the trial's `scheduledAt`.

| triggerEvent | template | base | offset | guard (besides consent + APPROVED template) | status |
|---|---|---|---|---|---|
| `LEAD_WELCOME` | `lead_welcome` | now | +2m | not CLOSED; no prior outbound WhatsApp | existing |
| `LEAD_WELCOME_FOLLOWUP` | `lead_welcome_followup` | now | +1440m | status in {NEW, CONTACTED} **and** no reply since enqueue | **new** |
| `NO_RESPONSE_NUDGE` | `no_response_nudge` | now | 0 | status = NO_RESPONSE | existing |
| `NO_RESPONSE_NUDGE_2` | `no_response_nudge_2` | now | +1440m | status = NO_RESPONSE **and** no reply since enqueue | **new** |
| `NO_RESPONSE_NUDGE_3` | `no_response_nudge_3` | now | +2880m | status = NO_RESPONSE **and** no reply since enqueue | **new** |
| `TRIAL_CONFIRMATION` | `trial_confirmation` | now | 0 | trial = SCHEDULED | existing (body adds a calendar line) |
| `TRIAL_REMINDER` | `trial_reminder` | trial | −1440m | trial = SCHEDULED and in the future | existing (the −24h reminder) |
| `TRIAL_REMINDER_1H` | `trial_reminder_1h` | trial | −60m | trial = SCHEDULED and in the future | **new** (holds the Zoom link text) |
| `TRIAL_JOIN_NOW` | `trial_join_now` | trial | −5m | trial = SCHEDULED (no future check — may land at start) | **new** |
| `POST_TRIAL_FOLLOW_UP` | `post_trial_followup` | now | **+60m** (was +1440) | lead not CONVERTED/CLOSED | offset change |

"No reply since enqueue" = no inbound WhatsApp `Message` for the lead with `createdAt` later than the scheduled row's `createdAt` (all sequence steps are enqueued together at the trigger, so the row's `createdAt` is the sequence anchor). "Progress" for #1 is covered by the status check (leaving NEW/CONTACTED ⇒ cancelled); for #2 by the NO_RESPONSE check.

## Assumptions

- Plans 005–007 present: engine (enqueue/`dedupeKey`/dispatch/`cancelForEntity`), monitoring, template editor; `MessageTemplate` seed uses `upsert` with `update: {}` so **operator-edited bodies are preserved** on re-seed.
- Inbound WhatsApp replies are logged as `Message` (direction INBOUND, channel WHATSAPP) on the lead's conversation (plan 004) — the basis for reply detection.
- `TrialLesson.scheduledAt` drives the −24h/−1h/−5m reminder times; reschedule updates it.
- SQLite/Prisma, no trailing semicolons, singular naming, PrismaClient singleton, Hebrew RTL, `{ error: { code, message }, requestId }`.

## Open Questions

> Resolved 2026-07-07 (approved "all recommended").

1. **Stop condition.** — Reply (inbound WhatsApp) **or** progress (trial scheduled / converted / closed); staff `NEW→CONTACTED` alone does not stop.
2. **Reply signal.** — Inbound WhatsApp message only; other channels stop a sequence only via a status change.
3. **Zoom link.** — Editable text inside the `trial_reminder_1h` template (no per-trial `meetingUrl` auto-insert this round).
4. **Plan doc.** — New plan 008; revises 005's Automation Map for #1–#4.

## Steps

### Step 1: Documentation
- `agent-files/.doc/architecture.md` — note the sequence behavior + reply-aware stop; Change Log 2026-07-07.
- `CLAUDE.md` — update the automation note (sequences: welcome 2-step, no-response 3-step, trial 4-message, post-trial +1h; reply-stop).
- `agent-files/.doc/product-definition.md` — reflect the real automation flows (business behavior).

### Step 2: Templates + rules seed
- `chore-app/backend/src/lib/automationSeed.ts`:
  - Add templates: `lead_welcome_followup`, `no_response_nudge_2`, `no_response_nudge_3`, `trial_reminder_1h` (with a "[הכניסו כאן קישור זום]" editable line), `trial_join_now`; set fresh-install default body for `trial_confirmation` with a calendar line (existing edited bodies preserved via `update: {}`).
  - Add rules for `LEAD_WELCOME_FOLLOWUP`, `NO_RESPONSE_NUDGE_2`, `NO_RESPONSE_NUDGE_3`, `TRIAL_REMINDER_1H`, `TRIAL_JOIN_NOW`.
  - Change rule seeding so an **existing** rule has its `templateName`/`offsetMinutes`/`name` synced to the code values (preserve `active`), applying the `POST_TRIAL_FOLLOW_UP` offset change (1440 → 60) without a DB reset.

### Step 3: Registry (variables + guards)
- `chore-app/backend/src/services/automation/registry.ts`:
  - Add entries for the 5 new triggerEvents (resolveVariables + guards per the spec table).
  - Add a shared `hasRepliedSince(leadId, since)` (INBOUND WhatsApp count) and use it in the `LEAD_WELCOME_FOLLOWUP` and `NO_RESPONSE_NUDGE_2/_3` guards.
  - `TRIAL_JOIN_NOW` guard omits the future check; the other reminders keep it.

### Step 4: Hooks
- `lead.service.createLead` — also enqueue `LEAD_WELCOME_FOLLOWUP` (source ≠ WHATSAPP path).
- `index.ts` aging loop — also enqueue `NO_RESPONSE_NUDGE_2` and `_3`.
- `trialLesson.service.createTrialLesson` — also enqueue `TRIAL_REMINDER_1H` and `TRIAL_JOIN_NOW`.
- `trialLesson.service.updateTrialLesson` (reschedule) — re-enqueue the −1h and −5m reminders (dueAt recomputed in place), alongside the existing confirmation/−24h re-enqueue.
- Post-trial `+60m` needs no hook change (offset comes from the rule).

### Step 5: Validation (see below)

## Validation

Manual + type/build (no suite). Run with the dev server stopped for deterministic dispatch (mock), data purged after.

1. Backend `tsc` clean; startup seeds the new rules/templates; monitoring `/rule` now lists the added rules; editor `/template` lists the new templates with correct `usedBy`.
2. **#1:** new lead enqueues welcome + follow-up (+24h). Force follow-up due with **no** inbound → sends. Re-run with an inbound WhatsApp logged after enqueue → follow-up **CANCELLED** (reply). With the lead moved to TRIAL_SCHEDULED → **CANCELLED** (progress).
3. **#2:** aging enqueues 3 steps at 0/+24h/+48h. Force each due: all send with no reply; an inbound after enqueue cancels the remaining steps; a status change out of NO_RESPONSE cancels the remaining steps.
4. **#3:** scheduling enqueues 4 rows with dueAt = now, −24h, −1h, −5m. Reschedule updates all three reminders' dueAt. Marking the trial COMPLETED/NO_SHOW/CANCELLED cancels the remaining reminders. `TRIAL_JOIN_NOW` still sends at/near start.
5. **#4:** completing a trial enqueues the follow-up at **+60m**; converting before then cancels it at dispatch.
6. Consent off → cancelled; template set DRAFT → FAILED `NO_APPROVED_TEMPLATE` + admin notified (unchanged safety).

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Reply detection misses a reply | Parent gets an unwanted follow-up | Count any INBOUND WhatsApp after the sequence anchor; anchor = row `createdAt` at enqueue |
| Seed offset-sync overwrites a future operator-tuned offset | Timing reset unexpectedly | Rule editing isn't exposed yet, so offsets are code-driven now; when rule editing lands, stop syncing offsets from seed |
| −5m message lands slightly after start (5-min tick) | "Join now" arrives at start | `TRIAL_JOIN_NOW` guard drops the future check so it still sends around start; acceptable at 5-min cadence |
| Re-seed clobbers edited template bodies | Lost operator content | Seed keeps `upsert … update: {}` — existing bodies preserved; only new templates created |
| More messages per lead | Parent fatigue | Hard stop-on-reply/progress on follow-ups; caps (2 / 3 / 4 / 1); per-rule `active` + `AUTOMATION_ENABLED` |

## Rollout Order

1. Step 1 — Docs
2. Step 2 — Seed (templates + rules + offset sync)
3. Step 3 — Registry (guards + `hasRepliedSince`)
4. Step 4 — Hooks (enqueue the new steps + reschedule)
5. Step 5 — Validate (#1 2-step, #2 3-step, #3 4-message, #4 +1h, reply/progress stops)

## Rollback

- Fully additive, no schema/migration: revert the seed/registry/hook edits; obsolete seeded rows can be pruned or the disposable `dev.db` reset.
- Runtime: `AUTOMATION_ENABLED` off halts all sends; per-rule `active=false` disables any single step (e.g., turn off a follow-up) with no deploy.
- All work on `feat/whatsapp`; `main` untouched; commit/merge only on explicit approval (`versioning-rules.md`).

## Execution Log

### 2026-07-07 — Implemented and validated (mock), committed on `feat/whatsapp` (not merged)
- Spec `4fede71`. Implementation `bfef8e7` (seed + registry + hooks + docs, single commit).
- Additive, no schema change: +5 templates / +5 rules; `post_trial_followup` 24h→1h; rule seeding syncs name/template/offset (preserves `active`); new `hasRepliedSince` guard for the follow-up steps.
- Validation (mock, scripted, 19/19): seed 12 rules/12 templates + offset sync; #1 opener + 24h follow-up (sends w/o reply, cancels on reply, cancels on progress); #2 three-step 0/+24h/+48h (all send, later step cancels on reply); #3 four-message ladder −24h/−1h/−5min (reschedule updates, complete cancels remaining); #4 post-trial at +1h. Backend `tsc` clean.
- The 5 new templates are editable in the plan-007 template editor (e.g. the Zoom link in `trial_reminder_1h`).

