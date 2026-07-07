# Plan 007: Automation Template Editor (content layer)

Status: draft
Owner: Amit Ohana
Last updated: 2026-07-07

Builds on [plan 005](005-2026-07-07-whatsapp-automation-engine.md) (engine) and [plan 006](006-2026-07-07-automation-monitoring-ui.md) (monitoring UI). Adds an admin content-management layer to edit the WhatsApp message text of each automation template inside the CRM. No rule editing, no engine change.

---

## Goal

Let admins edit the actual message wording each automation sends, from inside the CRM, with a clear view of which automation a template belongs to and which placeholders it may use. This is a content layer over `MessageTemplate` — it becomes the local source of truth that a future Meta template-approval flow will submit from.

## Scope

**In scope:**
- Backend, extending the existing admin `/api/automation` route (no engine change):
  - `GET /api/automation/template` — templates, each annotated with the automation(s) that use it (via `AutomationRule.templateName`) and its allowed placeholders (from the `variables` JSON).
  - `PUT /api/automation/template/:id` — edit the `body` only; validated so it references only the placeholders that automation provides; `status` (Meta-approval) preserved.
- Frontend, on the existing Automation page: a **Templates** section (list) + a per-template **edit modal** — shows the owning automation, an editable body, an insertable palette of the allowed placeholders, and a live preview rendered with sample values.

**Out of scope:**
- Automation-**rule** editing (timing / active / template mapping) — deferred.
- New or enriched variables / any `registry.ts` resolver change (existing variables only).
- Engine, schema, migration, or seed changes.
- Meta template create/submit/approval flow — future; `status` is displayed but not driven here.
- Template create/delete — only the seeded templates are edited.

## Assumptions

- Plans 005/006 present: `MessageTemplate` seeded (with `body` + `variables` JSON), `AutomationRule` links `triggerEvent → templateName`, and the admin `/api/automation` route exists with `authenticate` + `requireAdmin`.
- The seeded `variables` JSON order matches each automation's `registry.ts` `resolveVariables` output, so `{{1}}, {{2}}, …` (1-based) line up with the values the engine fills.
- `send.service` `interpolate` renders `{{n}}` positionally — the same model Meta templates use (forward-compatible).
- Repo conventions: no trailing semicolons, singular naming, error shape `{ error: { code, message, details? }, requestId }`, PrismaClient singleton, TanStack Query, `sonner`, `lucide-react`, Hebrew RTL.

## Open Questions

> Resolved 2026-07-07 (approved "all recommended").

1. **Editor placement.** — **Resolved: Templates section + edit modal on the existing Automation page** (not a separate route).
2. **Variable scope now.** — **Resolved: expose only each automation's existing variables** — no resolver/engine change; enriching sets (e.g. group name) is a later, contained addition.
3. **Plan doc.** — **Resolved: new plan 007** (006 stays the monitoring record).

## Steps

### Step 1: Documentation updates (first, no code risk)
- `agent-files/.doc/architecture.md` — note the `/api/automation` route now also serves admin template read + body edit (content layer); Change Log entry dated 2026-07-07.
- `CLAUDE.md` (root) — update the `/api/automation` row to mention template read + body edit.

### Step 2: Backend — template read + edit (admin)
- `chore-app/backend/src/routes/automation.ts` (existing, already `authenticate` + `requireAdmin`):
  - `GET /template` → `messageTemplate.findMany` (ordered by name); for each, attach `usedBy` = the `AutomationRule`s whose `templateName === template.name` (return `{ triggerEvent, name }`), and return `variables` as a **parsed** string array (names, or `[]`) so the client never parses JSON.
  - `PUT /template/:id` → body `{ body }`. Validate: `body` is a non-empty string; every `{{n}}` token is numeric with `1 <= n <= variables.length`; no non-numeric `{{…}}` tokens. On failure → `400 BAD_REQUEST` with a clear message. On success → update `body`, leave `status`/`variables` untouched, return the updated template.

### Step 3: Frontend types
- `chore-app/frontend/src/types.ts` — add `TemplateUsage { triggerEvent: string, name: string }` and a standalone `TemplateWithUsage { id, name, language, category, body, status, variables: string[], usedBy: TemplateUsage[] }` (its `variables` is the parsed array the endpoint returns).

### Step 4: Frontend — Templates section + editor modal
- Extend `chore-app/frontend/src/pages/Automation.tsx` with a **Templates** section: a table/list of templates showing template name, the owning automation label (reuse the `triggerLabel` map from the page), a short body preview, and an **ערוך** button.
- `chore-app/frontend/src/components/TemplateEditorModal.tsx` (new): props `{ template, onClose }`. Shows the owning automation, a body `textarea`, a **placeholder palette** (buttons per allowed variable that insert `{{n}}` at the cursor, labelled in Hebrew via a name→label map: `parentName→שם ההורה`, `childName→שם הילד/ה`, `date→תאריך`, `time→שעה`), and a **live preview** substituting sample values. Save → `PUT /api/automation/template/:id`, `sonner` success/error, invalidate `["automation","template"]`.

### Step 5: Validation (see below)

## Validation

Manual + type/build (no automated suite, per `testing-rules.md`).

1. Backend `tsc` clean; `GET /api/automation/template` as admin → 7 templates, each with `usedBy` (correct automation) + `variables`; as STAFF → `403`.
2. `PUT /api/automation/template/:id` with a valid edited body → `200`, body persists; a subsequent engine enqueue+dispatch (mock) renders the **new** text.
3. Invalid edits rejected: a `{{9}}` beyond the variable count → `400`; an empty body → `400`; both carry `requestId`.
4. Frontend `tsc` + `vite build` pass.
5. Browser: Templates section lists the 7 templates with the correct owning automation; the editor modal shows the placeholder palette + live preview; saving updates the body and the preview; the monitoring/outbox sections are unchanged.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Body references a placeholder the engine won't fill | Blank/garbled customer message | Validate every `{{n}}` against the template's variable count on save; fixed palette in the UI |
| Edited body diverges from a Meta-approved template (future) | Out-of-sync once real Meta is live | `status` preserved and shown; future re-approval/submit flow noted; harmless under mock |
| Operator unsure which variables exist | Wrong placeholders | Fixed palette + Hebrew legend + live sample preview |
| Concurrent edits | Last-write-wins overwrite | Acceptable at INNOKIDS scale (single small team); no locking |

## Rollout Order

1. Step 1 — Docs
2. Step 2 — Backend template read + edit endpoints
3. Step 3 — Types
4. Step 4 — Templates section + editor modal
5. Step 5 — Validate (admin read/edit, STAFF 403, invalid-edit 400, browser check)

## Rollback

- Fully additive: no schema, migration, seed, or engine change; edits only touch `MessageTemplate.body` (re-seedable / disposable `dev.db`).
- Revert by removing the two template endpoints and the Templates section + editor modal.
- All work on `feat/whatsapp`; `main` untouched; commit/merge only on explicit approval (`versioning-rules.md`).
