# Plan 013: Internal Calendar — per-staff scheduling views

Status: done
Owner: Amit Ohana
Last updated: 2026-07-10

The internal (no external setup) layer of the Calendar feature. Turns the current read-only month calendar into a per-staff scheduling tool with hourly views, sourced from existing CRM data through one normalized backend endpoint. Google Calendar OAuth sync is a separate future plan. Single-tenant.

Design approved via brainstorming 2026-07-09 (approach B — dedicated backend endpoint). Decisions locked: per-staff = both (personal by default, admin views any/all); all four event types; add hourly views.

---

## Goal

Each staff member sees their own schedule — trials they teach, group sessions they run, tasks assigned to them, follow-ups for their leads — on month and hourly week/day views. Admins can view any single staff member or the whole team.

## Scope

**In scope:**
- Backend `GET /api/calendar?staffId=&from=&to=` returning a normalized event list; `calendar.service.ts`; per-staff authorization (staff → own only, admin → any/all).
- Group sessions expanded server-side into concrete dated occurrences within the range.
- Frontend: one calendar query (driven by the visible range), `@fullcalendar/timegrid` month/week/day views, a staff selector, event click-through, updated legend.
- Tests for `calendar.service`.

**Out of scope:**
- Google Calendar OAuth sync (future plan).
- Creating / editing / drag-rescheduling events from the calendar — this phase is view + navigate only.
- Multi-tenancy.

## Assumptions

- Existing data suffices, no schema change: `TrialLesson` (`scheduledAt`, `durationMinutes`, `teacherId`), `Group` (`dayOfWeek`, `startTime`, `endTime`, `teacherId`, `status`), `Task` (`dueDate`, `assignedToId`, `status`, `priority`), `Lead` (`nextFollowUpDate`, `assignedToId`, `status`).
- FullCalendar is installed (`daygrid`, `interaction`); add `@fullcalendar/timegrid`.
- `req.user` carries `userId` and `role` (ADMIN/STAFF).
- Small team / hundreds of records — per-range server aggregation is light.
- Times are interpreted in `Asia/Jerusalem`.

## Open Questions

Resolved in brainstorming (see the locked decisions above). None outstanding.

## Steps

### Phase 1 — Backend: endpoint + service
1. `src/services/calendar.service.ts` — `getCalendarEvents({ from, to, staffId? })` returns a normalized array of `{ id, type, title, start, end?, allDay, entityType, entityId, color }`. `id` is type-prefixed for FullCalendar uniqueness (`trial-<id>`, `group-<id>-<date>`, `task-<id>`, `followup-<leadId>`):
   - **Trials** (`type: "TRIAL"`): `scheduledAt` in `[from,to]`, `teacherId = staffId` when set; `start = scheduledAt`, `end = scheduledAt + (durationMinutes ?? 45)`; `entityType: "LEAD"`, `entityId: leadId`; title `ניסיון: <lead name>`.
   - **Group sessions** (`type: "GROUP"`): `status = ACTIVE`, `teacherId = staffId` when set, `dayOfWeek` set; expand into one concrete event per matching weekday inside `[from,to]` using `startTime`/`endTime`; `entityType: "GROUP"`.
   - **Tasks** (`type: "TASK"`): `dueDate` in `[from,to]`, `assignedToId = staffId` when set; all-day on `dueDate`; color by `priority`/`status`; `entityType: "LEAD"|"STUDENT"` when linked.
   - **Follow-ups** (`type: "FOLLOW_UP"`): leads with `nextFollowUpDate` in `[from,to]`, `status` not in (`CLOSED`,`CONVERTED`), `assignedToId = staffId` when set; all-day; red when overdue; `entityType: "LEAD"`.
2. `src/routes/calendar.ts` — `GET /` (authenticate). Resolve the effective staff scope: **STAFF** is forced to `req.user.userId` (ignore any `staffId` in the query); **ADMIN** uses `staffId` when given (a specific person), or all staff when omitted / `staffId=all`. Require `from` and `to` (400 otherwise). Mount at `/api/calendar` in `src/index.ts`.
3. Shared weekday helper: move the existing Hebrew `dayOfWeek → number` map (currently inline in `frontend/src/pages/Calendar.tsx`) to a backend helper for the group-recurrence expansion.

### Phase 2 — Frontend
4. Install `@fullcalendar/timegrid`; register `dayGridMonth`, `timeGridWeek`, `timeGridDay` in `Calendar.tsx`.
5. `Calendar.tsx`: replace the three separate queries (trials/leads/groups) with a single `useQuery` to `/api/calendar`, keyed on the visible range and selected staff; refetch on FullCalendar's `datesSet`. Map normalized events → FullCalendar events (color, `allDay`, `start`/`end`).
6. Staff selector: admins get a dropdown (`אני` / each staff member / `כולם`) sourced from `/api/user`; staff see only their own (locked). Default = the current user.
7. Event click → navigate to the entity (`LEAD` → `/leads/:id`, `STUDENT` → `/students/:id`, etc.).
8. Update the color legend to include tasks.

### Phase 3 — Tests + verification
9. `test/calendar.service.test.ts`: staff filter (only the staff member's own trials/groups/tasks/follow-ups), group recurrence expansion within a range (correct weekdays + times, boundary weeks), all four types present, admin sees everyone, staff scoped to self.
10. Backend `tsc` + `npm test`; frontend `tsc` + `vite build`; live smoke against `/api/calendar`.

## Validation

- `calendar.service` tests green; full suite stays green.
- Live `GET /api/calendar?from=&to=` returns the four event types; `staffId` scoping enforced (staff cannot see another staff's events); group recurrences land on the right weekdays with correct times.
- Frontend: month + hourly week/day render; the staff selector filters; clicking an event navigates to its entity.

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Group recurrence expansion edge cases (timezone, week boundaries) | Wrong occurrence dates/times | Expand in `Asia/Jerusalem`; unit-test range boundaries; reuse the existing Hebrew weekday map |
| Staff passes another `staffId` | Staff sees a colleague's schedule | Server forces STAFF to own id; only ADMIN may pass `staffId` |
| Huge date range over-fetches | Slow query | Require `from`/`to`; frontend sends only the visible range |
| New endpoint diverges from the frontend event shape | Rendering bugs | One normalized `{type,title,start,end,allDay,entityType,entityId,color}` contract, covered by tests |

## Rollout Order

1. Phase 1 — backend endpoint + service + tests
2. Phase 2 — frontend timegrid + single query + staff selector
3. Phase 3 — verification
Branch `feat/calendar-internal`; PR + CI; merge on explicit approval.

## Rollback

- Fully additive: revert the branch/PR. No schema or data changes, so rollback is clean; the new endpoint simply goes unused if the frontend is reverted.
- The Google Calendar sync layer is intentionally deferred and unaffected.

## Execution Log

### 2026-07-09/10 — implemented on `feat/calendar-internal` (not committed)

- Phase 1: `calendar.service.ts` (four sources normalized, group weekly expansion, staff scoping) + `routes/calendar.ts` (STAFF locked to self, ADMIN any/all, `from`/`to` required) + mount. Live smoke against the running server returned TRIAL/TASK/FOLLOW_UP correctly.
- Phase 2: `Calendar.tsx` rewritten — single range-driven query, `@fullcalendar/timegrid` (month/week/day), admin staff selector, event click-through to entities, task color token (`--color-event-task`) + updated legend.
- Phase 3: 5 new tests in `test/calendar.service.test.ts` — **46/46 suite green**; backend + frontend `tsc` clean; `vite build` clean (completed 2026-07-10 after a transient infra outage blocked the shell overnight).

### 2026-07-10 — merged

- Committed as `87f867d`, PR #4, CI green (backend + frontend), merged to master (`c590468`); branch deleted.
