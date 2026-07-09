# Plan 012: CRM Usability — Hebrew statuses, flexible conversion, lead board + tags

Status: done
Owner: Amit Ohana
Last updated: 2026-07-09

Four owner-requested usability improvements. Feature 3 (Google Calendar) is split into its own future plan (needs Google OAuth + a sync engine). This plan covers features 1, 2, 4 — all internal to the CRM, no external setup. Implemented on branch `feat/crm-usability`.

---

## Goal

Make the CRM smoother for daily INNOKIDS use: Hebrew everywhere in the UI, a conversion flow that never blocks the operator, and a fast visual way to move and label leads.

## Scope

**In scope:**
- Hebrew UI labels for all pipeline statuses (DB values stay English).
- Lead→student conversion: create a group inline, and never hard-block on a full group (warn only).
- A Kanban board view of leads with free drag between any status (alongside the existing table).
- Free-form tags the operator creates, assigns per lead, and filters by.

**Out of scope:**
- Feature 3 — Google Calendar integration (personal + per-staff calendars, self-connect, lesson sync). Its own plan.
- Triggering automation sequences on a manual status drag.

## Assumptions

- Owner decisions: free drag between any status (no guard on manual moves); tags are operator-created (not a fixed list); board is added alongside the table, not a replacement.
- Internal enum values remain English; only display labels are Hebrew.
- SQLite + Prisma; implicit many-to-many is acceptable for lead↔tag.

## Open Questions

Resolved with the owner before implementation (see Assumptions). None outstanding.

## Steps

1. **Feature 1 — Hebrew statuses:** shared `frontend/src/lib/statusLabels.ts` (label map + `PIPELINE_STATUSES` + `statusLabel()`); `StatusBadge.tsx` imports it; used in the `LeadDetails.tsx` status dropdown and the `Leads.tsx` filter.
2. **Feature 2 — Flexible conversion:** `convertLead` (`backend/src/services/lead.service.ts`) drops the `GROUP_FULL` block, accepts a `newGroup` payload (via `createGroup`), and still rejects a missing group id; `routes/lead.ts` convert handler updated; `addStudentToGroup` (`group.service.ts`) gains an `allowOverfill` flag; `StudentModal.tsx` gets an inline "new group" option + a full-group warning.
3. **Feature 4a — Board:** `@dnd-kit/*` added; `frontend/src/components/LeadBoard.tsx` (8 columns, free drag → `PUT /lead/:id/status`); view toggle in `Leads.tsx`; `setLeadStatus` gains a `force` option (skips `canTransition`) and `updateLeadStatus` passes it — manual moves are unrestricted, system callers unchanged.
4. **Feature 4b — Tags:** `Tag` model + implicit m2m to `Lead` (migration `20260709144303_add_tags`); `tag.service.ts` + `routes/tag.ts` (`/api/tag`); lead route gains tag assign/unassign, `tags` include, and `?tagId=` filter; `index.ts` mounts the route and seeds 5 default tags; `TagPicker.tsx` (+ `TagChips`) on lead detail, table rows, and board cards; `types.ts` updated.

## Validation

- Backend + frontend `tsc` clean; frontend `vite build` clean.
- Backend `npm test`: 41/41 pass (34 existing + 7 new in `test/crmUsability.test.ts` covering full-group convert, inline-group convert, missing-group rejection, free manual transition, preserved system guard, and tag CRUD/filter).
- Live API smoke (running server): 14/14 — tag CRUD + filter, illegal status jump succeeds, convert into full group, convert with new group; throwaway data cleaned up.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Removing the transition guard on manual moves | Operator can set nonsensical statuses | Intended per owner; system auto-transitions still guarded; every move is activity-logged |
| Over-filled groups | Capacity no longer enforced on convert/assign | Intended (owner decides); group still flips to `FULL` for visibility; warning shown |
| New m2m migration on prod SQLite | Schema drift | Standard Prisma migration; verified against the test DB (41 tests) and dev DB |

## Rollout Order

1. F1 (frontend-only, low risk)
2. F2 (backend + modal)
3. F4a (board + backend force)
4. F4b (schema migration + tags) — has the DB migration

## Rollback

- Revert the `feat/crm-usability` branch/PR — all changes are additive.
- The tags migration can be rolled back with a down migration; no existing data depends on tags.
- `allowedTransitions` / `canTransition` remain in the code, so re-enabling the guard is a one-line change.

## Execution Log

### 2026-07-09 — implemented on `feat/crm-usability` (not committed)
- All four steps implemented and verified (see Validation). Feature 3 deferred to a future plan.
- Uncommitted working tree also still carries earlier same-day work (trial-lesson `meetingUrl` feature, WhatsApp config/doc changes) that predates this branch.
