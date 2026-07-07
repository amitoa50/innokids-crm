# Plan 006: Automation Monitoring UI (read-only)

Status: draft
Owner: Amit Ohana
Last updated: 2026-07-07

Builds on [plan 005](005-2026-07-07-whatsapp-automation-engine.md) (the automation engine). Adds an admin-only, read-only screen to see the configured automation rules and the `ScheduledMessage` outbox — no engine changes.

---

## Goal

Give admins a single screen to trust and debug the WhatsApp automation engine: which rules exist and their timing/active state, and what the outbox is doing (pending / sent / failed / cancelled, with failure reasons). Strictly read-only in this slice; the same route is the future home for toggle/retry/cancel controls.

## Scope

**In scope:**
- Backend admin-guarded read route `chore-app/backend/src/routes/automation.ts`:
  - `GET /api/automation/rule` — all `AutomationRule` rows.
  - `GET /api/automation/scheduled-message?status=&limit=` — `{ counts, items }`; per-status counts over all rows + a filtered, limited, newest-first item list with the triggering lead and the `triggerEvent` (derived from `dedupeKey`).
- Frontend admin page `chore-app/frontend/src/pages/Automation.tsx` with a Rules section and an Outbox section (status-filter chips with counts), mounted under `AdminRoute` with an `isAdmin`-gated sidebar item.
- `StatusBadge` + `badge.css` extended with `SENT` / `SENDING` / `FAILED` (existing `PENDING`, `CANCELLED` reused).
- Friendly Hebrew labels for `triggerEvent` and `offsetMinutes` timing (frontend display map).

**Out of scope (next slice):**
- Any mutation — toggle rule active, retry, cancel, edit timing/template.
- Template viewer/registry admin UI.
- Pagination beyond a capped limit.
- Any change to the engine, schema, or seeds.

## Assumptions

- Plan 005 engine is present: `AutomationRule` + `ScheduledMessage` seeded; `dedupeKey` format is `"<triggerEvent>:<entityType>:<entityId>"`; statuses `PENDING/SENDING/SENT/FAILED/CANCELLED`.
- Admin guard exists: `authenticate` + `requireAdmin` in `src/middleware/auth.ts` (`403 FORBIDDEN` for non-admins), used exactly like `routes/user.ts`.
- Frontend patterns: `AdminRoute` in `App.tsx`, `isAdmin` sidebar gating in `Layout.tsx`, TanStack Query, `sonner`, `lucide-react`, `StatusBadge` + `styles/cmps/badge.css` design tokens, Hebrew RTL.
- Repo conventions: no trailing semicolons, singular route/service names, error shape `{ error: { code, message, details? }, requestId }`, PrismaClient singleton, Express v5 native async errors.
- Types `AutomationRule` and `ScheduledMessage` already exist in `frontend/src/types.ts` (from plans 003/004) and will be extended as needed.

## Open Questions

> Resolved 2026-07-07 during brainstorming.

1. **Capability.** Read-only monitoring vs. controls. — **Resolved: read-only monitoring** (option 1); controls are the next slice.
2. **Audience.** Admin-only vs. all staff. — **Resolved: admin-only** (`AdminRoute` + `requireAdmin`), matching the role model and `/api/user`.
3. **Content.** — **Resolved: rules + outbox both**, on one page.
4. **Structure.** — **Resolved: Approach 1** — a dedicated `automation` read route + a new admin page (isolated domain, honest admin boundary, natural home for future controls).

## Steps

### Step 1: Documentation updates (first, no code risk)
- `agent-files/.doc/architecture.md` — add the `/api/automation` read route (admin-only) and the Automation monitoring page; note the auth boundary (admin-only) in the Auth section; Change Log entry dated 2026-07-07.
- `CLAUDE.md` (root) — add `/api/automation` to the route table and `Automation.tsx` to the page list.

### Step 2: Backend read route
- `chore-app/backend/src/routes/automation.ts` — `router.use(authenticate); router.use(requireAdmin)`.
  - `GET /rule` → `prisma.automationRule.findMany({ orderBy: { id: "asc" } })`.
  - `GET /scheduled-message` → parse `status` (whitelist `PENDING/SENDING/SENT/FAILED/CANCELLED`; unknown → no filter) and `limit` (default 100, cap 200). Return `{ counts, items }`: `counts` via `groupBy` on `status` (0-filled for missing); `items` via `findMany` (filtered, `orderBy createdAt desc`, `take limit`, `include lead { select id, fullName }`), each augmented with `triggerEvent = dedupeKey.split(":")[0]`.
- `chore-app/backend/src/index.ts` — `app.use("/api/automation", automationRoutes)`.

### Step 3: Frontend types
- `chore-app/frontend/src/types.ts` — ensure `AutomationRule` and `ScheduledMessage` fields match; add a `ScheduledMessageItem` (adds `lead { id, fullName }` + `triggerEvent`) and a `ScheduledMessageList { counts: Record<string, number>, items: ScheduledMessageItem[] }`.

### Step 4: StatusBadge + badge styles
- `chore-app/frontend/src/components/StatusBadge.tsx` — add labels `SENT: "נשלח"`, `SENDING: "בשליחה"`, `FAILED: "נכשל"` and classes `badge--sent`, `badge--sending`, `badge--failed`.
- `chore-app/frontend/src/styles/cmps/badge.css` — add tokens for the three new classes (CSS variables, per `style-rules.md`).

### Step 5: Frontend page
- `chore-app/frontend/src/pages/Automation.tsx`:
  - Header `אוטומציות`.
  - **Rules** table: `rule.name`, trigger (friendly label), template, timing (friendly: `0→מיידי`, `-1440→24 ש׳ לפני`, `1440→יום אחרי`, `180→3 ש׳ אחרי`), active/inactive pill.
  - **Outbox**: status-filter chips with counts (הכל/ממתין/נשלח/נכשל/בוטל), table of lead (link `/leads/:id`), automation type (friendly), template, `StatusBadge`, due time (`dueAt`), last-update time (`updatedAt` — reflects when it was SENT/FAILED/CANCELLED), failure reason (FAILED/CANCELLED).
  - Two TanStack queries (`["automation","rule"]`, `["automation","scheduled-message", status]`); local `status` state; `refetchInterval` ~30s; loading + empty states; `sonner` toast on error.
  - Small display maps (triggerEvent → Hebrew, offsetMinutes → friendly) local to the page.

### Step 6: Routing + navigation
- `chore-app/frontend/src/App.tsx` — `<Route path="automation" element={<AdminRoute><Automation/></AdminRoute>} />`.
- `chore-app/frontend/src/components/Layout.tsx` — `isAdmin` sidebar item `אוטומציות` (lucide `Workflow`).

### Step 7: Validation (see Validation section)

## Validation

Manual + type/build (no automated suite, per `testing-rules.md`).

1. Backend `tsc` clean; `GET /api/automation/rule` as admin → 7 rules; as STAFF → `403 FORBIDDEN` with `requestId`.
2. `GET /api/automation/scheduled-message` → `{ counts, items }`; `?status=FAILED` filters; `?limit=` respected and capped; each item carries `lead` + `triggerEvent`.
3. Frontend `tsc` + `vite build` pass.
4. Browser: the `אוטומציות` nav item appears for admin only (hidden for STAFF; direct URL redirects STAFF to `/dashboard`).
5. Rules section shows the 7 rules with correct timing/active state.
6. Trigger a couple of automations (or seed rows) so the outbox has data; verify status chips + counts, failure reasons on FAILED/CANCELLED, and that the lead link navigates to `/leads/:id`.
7. Polling refresh updates the outbox without a manual reload.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Outbox grows large over time | Slow query / big payload | Capped `limit` (≤200) + status filter; server-side counts via `groupBy`; pagination deferred |
| New badge statuses unstyled | Ugly fallback badge | Add `SENT/SENDING/FAILED` to `StatusBadge` + `badge.css` before shipping the page |
| Admin guard omitted | STAFF sees automation internals | `requireAdmin` on the route + `AdminRoute` on the page; test the `403`/redirect |
| Polling load on SQLite | Contention on busy days | 30s interval + small capped list; acceptable at INNOKIDS scale |
| `dedupeKey` missing on a legacy row | `triggerEvent` blank | Guard the `split`; fall back to an empty label, never throw |

## Rollout Order

1. Step 1 — Docs
2. Step 2 — Backend read route + mount
3. Step 3 — Types
4. Step 4 — StatusBadge + badge.css
5. Step 5 — Automation page
6. Step 6 — Routing + nav
7. Step 7 — Validate (admin 200 / STAFF 403, filter/counts, browser check)

## Rollback

- Fully additive and read-only: no schema, migration, seed, or engine change.
- Revert by removing the route mount + `routes/automation.ts`, the page, and the nav/route entries; `StatusBadge`/`badge.css` additions are harmless if left.
- All work on `feat/whatsapp`; `main` untouched; commit/merge only on explicit approval (`versioning-rules.md`).
