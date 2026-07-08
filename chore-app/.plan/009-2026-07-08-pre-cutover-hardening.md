# Plan 009: Pre-Cutover Hardening & Cleanup

Status: active
Owner: Amit Ohana
Last updated: 2026-07-08

Closes the technical-debt items identified before the live Meta Cloud API cutover: an automated regression suite for the automation engine ([plan 005](005-2026-07-07-whatsapp-automation-engine.md) / [008](008-2026-07-07-automation-sequences.md)), a template-approval drift guard on the editor ([plan 007](007-2026-07-07-automation-template-editor.md)), documentation drift fixes, production-safe admin seeding, and a CI workflow. Meta cutover itself is explicitly out of scope.

---

## Goal

Make the automation engine regression-protected, drift-safe, documented, and credential-safe so the Meta cutover can start from a trustworthy baseline. No engine behavior changes except one: editing an APPROVED template under the `cloud` provider revokes its approval.

## Scope

**In scope:**
1. **Automated tests (backend):** Vitest suite running against a throwaway SQLite database (schema via `prisma db push`) and the existing mock WhatsApp provider, covering dispatch claiming, dispatch-time guards, reply-aware stops, reschedule/cancel, template-approval failure, and consent-revoked behavior.
2. **Template drift guard:** editing the body of an `APPROVED` template while `WHATSAPP_PROVIDER=cloud` flips its `status` to `DRAFT` (re-approval required); under `mock` behavior is unchanged. Editor UI warns when editing an approved template and reports the revocation. Route logic extracted to `template.service.ts` for testability.
3. **Documentation drift:** plan 007 marked `done` with a short execution log; `CLAUDE.md` test-suite notes updated.
4. **Admin seed hardening:** `seedAdmin` moves to `src/lib/adminSeed.ts`; seeds from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when set; the `admin@office.local`/`admin123` fallback runs only when `NODE_ENV !== "production"`; production with no users and no env credentials refuses to seed (clear error, server still boots).
5. **CI:** GitHub Actions workflow — backend (generate, build, test) + frontend (build) on push to `master` and on PRs.

**Out of scope:**
- Meta cutover work of any kind (credentials, webhook hosting, template submission).
- Automation-rule editing UI, group fan-out (#7), per-trial `meetingUrl`.
- Frontend component tests; test coverage beyond the automation engine + the two hardened areas.
- Forced password change / user-management changes beyond the seed.

## Assumptions

- Engine internals per plans 005/008: `enqueue` upserts on `dedupeKey` and never resurrects terminal rows; `dispatchDue` claims `PENDING → SENDING` via `updateMany`, re-checks registry guards, consent, and template approval; failures notify admins.
- `seedAutomation()` is idempotent and marks templates `APPROVED` only when `WHATSAPP_PROVIDER=mock`; tests reuse it for realistic rule/template state.
- `getWhatsAppConfig()` reads `process.env` at call time, so tests can switch provider per test.
- Vitest can run the existing CommonJS TypeScript directly; a per-run SQLite file (absolute `file:` URL) isolates tests from `dev.db`; single-threaded execution avoids SQLite write contention between test files.
- Repo conventions apply: no trailing semicolons, singular naming, PrismaClient singleton, error shape `{ error: { code, message, details? }, requestId }`, Hebrew RTL UI.

## Open Questions

> Resolved 2026-07-08 with the owner before execution.

1. **Drift behavior.** Flip `APPROVED → DRAFT` on body edit under `cloud`, or hard-block edits of approved templates? — **Resolved: flip to DRAFT** (dispatch already fails safe on non-approved templates and notifies admins; the editor stays usable for pre-submission work).
2. **CI now or later?** — **Resolved: include a minimal GitHub Actions workflow** in this workstream.

## Steps

### Step 1: Docs (this plan + plan 007 drift)
- Add this plan file.
- `chore-app/.plan/007-2026-07-07-automation-template-editor.md` — `Status: draft → done`, `Last updated: 2026-07-08`, add an Execution Log citing commits `8a9a7c7` (admin template read + body-edit API) and `4924f61` (editor UI) and the validation performed.

### Step 2: Test harness + engine regression suite
- `chore-app/backend/package.json` — add `vitest` (devDependency), script `"test": "vitest run"`.
- `chore-app/backend/vitest.config.ts` — Node environment, `fileParallelism: false` (single SQLite file), `globalSetup` + `setupFiles` wiring.
- `chore-app/backend/test/global-setup.ts` — delete any stale test DB, run `prisma db push --skip-generate` against the absolute test-DB URL.
- `chore-app/backend/test/setup.ts` — set `DATABASE_URL` (same absolute URL), `WHATSAPP_PROVIDER=mock`, `JWT_SECRET` before any app import.
- `chore-app/backend/test/helpers/db.ts` — `resetDb()` (wipe all tables in FK-safe order, re-run `seedAutomation()`), factories: `createAdmin`, `createLead` (unique `phoneNormalized`, consent on), `createTrial`, `createScheduledRow` (explicit `dedupeKey`/`dueAt`/`createdAt`), `logInboundWhatsApp(leadId)`.
- `chore-app/backend/test/automation.engine.test.ts` — behaviors:
  - **Claiming:** a `SENDING` row is not re-sent; two consecutive `dispatchDue()` runs over one due row produce exactly one outbound `Message` and one `SENT` row; `enqueue` never resurrects a terminal (`SENT`) row.
  - **Guards:** `TRIAL_REMINDER` cancelled (`TRIAL_NOT_SCHEDULED`) when the trial is not `SCHEDULED`; `POST_TRIAL_FOLLOW_UP` cancelled when the lead is `CONVERTED`; `LEAD_WELCOME` cancelled (`ALREADY_CONTACTED`) when a prior outbound WhatsApp exists.
  - **Reply-aware stops:** `LEAD_WELCOME_FOLLOWUP` and `NO_RESPONSE_NUDGE_2` send with no reply, cancel (`REPLIED`) when an inbound WhatsApp `Message` postdates the row's `createdAt`, and cancel on status progress.
  - **Reschedule/cancel:** re-`enqueue` of `TRIAL_REMINDER` with a new `baseTime` updates the single pending row's `dueAt` in place (`dueAt = baseTime − 1440m`); `cancelForEntity` cancels pending rows for the entity and leaves `SENT` rows untouched.
  - **Template approval failure:** template set `DRAFT` → row `FAILED NO_APPROVED_TEMPLATE` + admin `Notification` created.
  - **Consent revoked:** `whatsappConsent=false` → row `CANCELLED CONSENT_REVOKED`, no `Message` written.
- `CLAUDE.md` — replace the "No test suite" key note with the backend test command; note the suite's scope.
- `chore-app/.gitignore` — ignore the test DB file.

### Step 3: Template drift guard
- `chore-app/backend/src/services/template.service.ts` — new `updateTemplateBody(id, body)`: not-found / empty-body / placeholder-range validation (moved from the route), then update; when the template is `APPROVED` and `getWhatsAppConfig().provider === "cloud"`, also set `status: "DRAFT"`; returns `{ template, approvalRevoked }` or a typed domain error.
- `chore-app/backend/src/routes/automation.ts` — `PUT /template/:id` delegates to the service; success response is the updated template plus `approvalRevoked`.
- `chore-app/frontend/src/components/TemplateEditorModal.tsx` — static notice when the opened template is `APPROVED` ("שמירת שינוי בתבנית מאושרת עשויה לדרוש אישור מחדש של מטא"); on save, if the response has `approvalRevoked`, show a warning toast ("התבנית סומנה כטיוטה — נדרש אישור מחדש של מטא") instead of the plain success toast.
- `chore-app/backend/test/template.service.test.ts` — cloud+`APPROVED` edit flips to `DRAFT` with `approvalRevoked`; mock+`APPROVED` edit keeps `APPROVED`; cloud+`DRAFT` edit stays `DRAFT` (no false revocation flag); invalid placeholder and empty body rejected.

### Step 4: Admin seed hardening
- `chore-app/backend/src/lib/adminSeed.ts` — new home for `seedAdmin()`: no-op when users exist; seed from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when both set; otherwise in production log an explicit refusal and seed nothing; otherwise seed the dev default with a warning.
- `chore-app/backend/src/index.ts` — import `seedAdmin` from the lib; drop the inline function and the now-unused `bcrypt` import.
- `chore-app/backend/.env.example` — add commented `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- `CLAUDE.md` — key note: default admin is dev-only; production requires env credentials.
- `chore-app/backend/test/adminSeed.test.ts` — env credentials used when set (bcrypt-verified); production + no env → zero users seeded; dev + no env → default seeded; existing users → no-op.

### Step 5: CI workflow
- `.github/workflows/ci.yml` (repo root) — on push to `master` + all PRs; backend job (`npm ci`, `prisma generate`, `npm run build`, `npm test`) and frontend job (`npm ci`, `npm run build`), Node 22, working directories under `chore-app/`.

## Validation

1. `npm test` in `chore-app/backend` — full suite green, deterministic, no touch of `dev.db`.
2. Backend `npm run build` (tsc) and frontend `tsc && vite build` clean.
3. Manual: editor shows the approved-template notice; API-level check that a `cloud`-mode body edit returns `approvalRevoked: true` and the template reads `DRAFT`.
4. Manual: backend boot with `NODE_ENV=production` + empty DB + no `ADMIN_EMAIL` logs the refusal and creates no user; dev boot still seeds the default with a warning.
5. CI workflow YAML validated by pushing the branch (or `act`-style dry read); jobs mirror the local commands exactly.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Test DB URL resolution differs between `db push` and the client | Suite fails or hits `dev.db` | Single absolute `file:` URL built in one helper, used by both |
| SQLite write contention across parallel test files | Flaky suite | `fileParallelism: false`; full reset per test |
| Millisecond-equal `createdAt` breaks reply-anchor tests | Flaky reply tests | Factories set explicit past `createdAt` on scheduled rows |
| Flip-to-DRAFT halts a live automation mid-flight | Sends stop until re-approval | Intended fail-safe: dispatch marks `FAILED NO_APPROVED_TEMPLATE` + notifies admins; editor warns before save |
| Production boot with no admin refused | Operator locked out at first deploy | Clear log line names the exact env vars; documented in `.env.example` + `CLAUDE.md` |
| CI red on first push (env drift) | Noise | Jobs run the same commands validated locally first |

## Rollout Order

1. Step 1 — docs (plan 009 + plan 007 fix) — commit `docs(plan): add pre-cutover hardening plan; mark plan 007 done`
2. Step 2 — test harness + engine suite — commit `test(automation): add Vitest harness and engine regression suite`
3. Step 3 — drift guard + tests — commit `feat(automation): revoke template approval on body edit under cloud provider`
4. Step 4 — admin seed + tests — commit `feat(auth): env-driven admin seed with dev-only default credentials`
5. Step 5 — CI — commit `ci: add GitHub Actions workflow for backend tests and builds`

## Rollback

- Branch `chore/pre-cutover-hardening` off `master`; `master` untouched until explicit merge approval (`versioning-rules.md`).
- Each commit is independently revertable; Steps 2/5 add no production code paths.
- Drift guard: reverting `template.service.ts` + the route delegation restores prior behavior; no schema change anywhere in this plan.
- Admin seed: reverting `adminSeed.ts` + the `index.ts` import restores the inline dev seed.

## Execution Log

_(added as steps complete)_
