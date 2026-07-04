# Plan 002: INNOKIDS CRM Core Refactor

Status: implemented
Owner: Claude
Last updated: 2026-07-04

---

## Goal

Refactor the chore-app into INNOKIDS CRM Core (Phase 1). Replace the Chore domain model with Lead, Student, Group, TrialLesson, Task, and ActivityLog entities. Restructure frontend pages for CRM workflow. Add integration-ready lead intake webhook layer. Align all code with repository rules (CSS variables, error shape with requestId, singular naming, no trailing semicolons).

## Scope

**In scope:**
- New Prisma schema with all CRM entities
- Backend routes and services for Lead, Student, Group, TrialLesson, Task, Report, LeadIntake
- Frontend pages: Dashboard, Leads, LeadDetails, Tasks, TrialLessons, Calendar, Students, StudentDetails, Groups, Team
- CSS refactor: main.css entry point with setup/basics/cmps structure, CSS variables for design tokens
- requestId middleware on all API responses
- Phone normalization utility and dedup logic
- Webhook endpoint structure with source normalizers
- API key middleware for webhooks
- Glossary, architecture, product-definition doc updates
- CLAUDE.md update

**Out of scope:**
- WhatsApp / Communication Engine (Phase 2)
- Automation Engine (Phase 3)
- Kanban board view for leads (deferred)
- Teacher role (V2)
- Test suite (documented as absent per CLAUDE.md)

## Assumptions

- SQLite remains the database (string fields for enums)
- Express v5 handles async errors natively (no try/catch wrappers needed)
- Existing auth system (JWT + bcrypt) is reused as-is
- PrismaClient singleton pattern continues
- Tailwind CSS v4 stays as utility layer, augmented with CSS custom properties
- Admin seed credentials remain admin@office.local / admin123
- uuid package will be added for requestId generation

## Open Questions

None — all questions resolved during brainstorming.

## Steps

### Step 1: Documentation updates

Update project documentation before touching code.

**Files to modify:**
- `agent-files/.doc/glossary.md` — add CRM domain terms (lead, student, group, trial-lesson, task, activity-log, lead-intake)
- `agent-files/.doc/architecture.md` — fill with INNOKIDS CRM architecture (components, data flow, auth boundaries, external deps)
- `agent-files/.doc/product-definition.md` — fill with INNOKIDS product vision, target users, problem statement, scope
- `agent-files/.rule/database-rules.md` — document Prisma as source of truth, note deviation from schema.sql convention

**Files to modify (project root):**
- `CLAUDE.md` — update project description from chore-app to INNOKIDS CRM, update structure, routes, setup commands, key notes

### Step 2: Branch setup

- Create branch `feat/crm-core` from current state
- All implementation work on this branch per versioning-rules.md

### Step 3: Install new dependencies

**Backend — `chore-app/backend/`:**
- `npm install uuid`
- `npm install -D @types/uuid`

No other new dependencies needed — existing stack covers all requirements.

### Step 4: Database schema

**File to modify:** `chore-app/backend/prisma/schema.prisma`

Replace the entire schema. Remove Chore model. Add all CRM models:

- **User** — modify: add `status` field (String, default "ACTIVE"), change role default from "MEMBER" to "STAFF"
- **Lead** — new: fullName, phone, phoneNormalized (unique), email, source, campaignName, status, assignedToId (FK->User), nextFollowUpDate, lastContactDate, learningFormat, branch, closedReason, notes
- **Student** — new: leadId (FK->Lead), childName, childBirthYear, learningFormat, branch, status, groupId (FK->Group), enrolledAt, notes
- **Group** — new: name, type, ageRange, learningFormat, branch, dayOfWeek, time, maxCapacity, teacherId (FK->User), status
- **TrialLesson** — new: leadId (FK->Lead), groupId (FK->Group), scheduledAt, status, outcome, teacherId (FK->User), notes
- **Task** — new: title, description, type, priority, status, dueDate, assignedToId (FK->User), leadId (FK->Lead), studentId (FK->Student), completedAt
- **ActivityLog** — new: type, description, leadId (FK->Lead), studentId (FK->Student), performedById (FK->User), metadata (JSON)
- **LeadIntake** — new: source, rawPayload (JSON), status, leadId (FK->Lead), errorMessage
- **Notification** — keep as-is
- **Chore** — remove

After schema change:
- Delete existing `dev.db` and migration history (fresh start for CRM)
- Run `npx prisma migrate dev --name crm-core-init`
- Run `npx prisma generate`

### Step 5: Backend — shared utilities

**Files to create:**
- `chore-app/backend/src/lib/requestId.ts` — middleware that generates UUID v4, attaches to `req`, sets `x-request-id` response header, and makes it available for JSON responses
- `chore-app/backend/src/lib/phoneNormalizer.ts` — `normalizePhone(raw: string): string` function (strip formatting, convert Israeli numbers to +972 format)

**Files to modify:**
- `chore-app/backend/src/middleware/auth.ts` — update error responses to include `requestId` from req
- `chore-app/backend/src/lib/prisma.ts` — no changes needed

**Files to create:**
- `chore-app/backend/src/middleware/apiKey.ts` — middleware that validates `x-api-key` header or `api_key` query param against `WEBHOOK_API_KEY` env var

### Step 6: Backend — services layer

**Files to create:**
- `chore-app/backend/src/services/lead.service.ts` — lead business logic:
  - `createLead(data, performedById?)` — normalize phone, dedup check, create or merge, log activity
  - `updateLeadStatus(id, newStatus, performedById)` — update status, create ActivityLog
  - `assignLead(id, staffId, performedById)` — assign staff, create ActivityLog
  - `convertLead(id, studentData, performedById)` — create Student, set lead CONVERTED, log activity
  - `reopenLead(id, performedById)` — set CLOSED lead back to NEW, log activity
  - `addNote(id, note, performedById)` — append note, create ActivityLog
- `chore-app/backend/src/services/student.service.ts` — student CRUD logic
- `chore-app/backend/src/services/group.service.ts` — group CRUD, add/remove student
- `chore-app/backend/src/services/trialLesson.service.ts` — trial CRUD, status changes (auto-update lead status to TRIAL_SCHEDULED/TRIAL_COMPLETED)
- `chore-app/backend/src/services/task.service.ts` — task CRUD, complete logic
- `chore-app/backend/src/services/activityLog.service.ts` — `logActivity(type, description, { leadId?, studentId?, performedById?, metadata? })`
- `chore-app/backend/src/services/notification.service.ts` — `createNotification(userId, message)`
- `chore-app/backend/src/services/normalizer/facebook.ts` — extract fullName, phone, email, campaignName from Meta Lead Ads payload
- `chore-app/backend/src/services/normalizer/instagram.ts` — extract from Instagram lead form payload
- `chore-app/backend/src/services/normalizer/website.ts` — extract from website contact form payload
- `chore-app/backend/src/services/normalizer/default.ts` — generic fallback normalizer

**Files to keep (modify):**
- `chore-app/backend/src/services/email.ts` — keep as-is, no changes

**Files to delete:**
- `chore-app/backend/src/services/recurrence.ts`

### Step 7: Backend — routes

**Files to create:**
- `chore-app/backend/src/routes/lead.ts` — GET /, GET /:id, POST /, PUT /:id, PUT /:id/status, PUT /:id/assign, POST /:id/convert, POST /:id/reopen, POST /:id/note
- `chore-app/backend/src/routes/leadIntake.ts` — POST /webhook/:source, GET /log
- `chore-app/backend/src/routes/student.ts` — GET /, GET /:id, POST /, PUT /:id
- `chore-app/backend/src/routes/group.ts` — GET /, GET /:id, POST /, PUT /:id, POST /:id/student, DELETE /:id/student/:studentId
- `chore-app/backend/src/routes/trialLesson.ts` — GET /, POST /, PUT /:id, PUT /:id/status
- `chore-app/backend/src/routes/task.ts` — GET /, POST /, PUT /:id, PUT /:id/complete, DELETE /:id
- `chore-app/backend/src/routes/report.ts` — GET /dashboard, GET /pipeline, GET /source, GET /staff-performance

**Files to modify:**
- `chore-app/backend/src/routes/auth.ts` — update error responses to include requestId
- `chore-app/backend/src/routes/users.ts` — rename to `user.ts`, update for new User model (status field, role ADMIN/STAFF), include requestId in responses
- `chore-app/backend/src/routes/notifications.ts` — rename to `notification.ts`, include requestId in responses

**Files to delete:**
- `chore-app/backend/src/routes/chores.ts`
- `chore-app/backend/src/routes/reports.ts` (replaced by `report.ts`)

### Step 8: Backend — entry point

**File to modify:** `chore-app/backend/src/index.ts`

- Add requestId middleware (applied before all routes)
- Remove chore route mounting
- Add new route mountings: /api/lead, /api/lead-intake, /api/student, /api/group, /api/trial-lesson, /api/task, /api/report, /api/user, /api/notification
- Update cron job: replace overdue chore check with overdue follow-up check (find leads with nextFollowUpDate < now, status not CLOSED/CONVERTED, notify assigned staff)
- Update admin seed: use role "ADMIN" (keep same credentials)
- Add WEBHOOK_API_KEY to .env.example

**File to modify:** `chore-app/backend/.env.example`

- Add `WEBHOOK_API_KEY=your-webhook-api-key-here`

**File to modify:** `chore-app/backend/.env`

- Add `WEBHOOK_API_KEY=dev-webhook-key-123`

### Step 9: Frontend — CSS refactor

**Files to create:**
- `chore-app/frontend/src/styles/main.css` — entry point that imports setup, basics, cmps + Tailwind
- `chore-app/frontend/src/styles/setup/variables.css` — CSS custom properties for all design tokens (brand colors, pipeline status colors, priority colors, calendar event colors, spacing, border radius)
- `chore-app/frontend/src/styles/basics/typography.css` — base text styles if needed
- `chore-app/frontend/src/styles/cmps/badge.css` — status badge styles using CSS variables, text-transform for label casing
- `chore-app/frontend/src/styles/cmps/timeline.css` — activity timeline styles

**Files to modify:**
- `chore-app/frontend/src/main.tsx` — change CSS import from `./index.css` to `./styles/main.css`

**Files to delete:**
- `chore-app/frontend/src/index.css` (replaced by styles/main.css)

### Step 10: Frontend — types and API client

**File to modify:** `chore-app/frontend/src/types.ts`

Replace all types. Remove Chore, AuthResponse (keep), Stats. Add:
- User (id, email, name, role, status, createdAt)
- Lead (all fields from data model)
- Student (all fields + lead relation)
- Group (all fields + students relation)
- TrialLesson (all fields + lead, group relations)
- Task (all fields + lead, student, assignedTo relations)
- ActivityLog (all fields)
- LeadIntake (all fields)
- Notification (keep, no changes)
- AuthResponse (keep, no changes)
- DashboardStats (newLeads, trialsScheduled, conversions, activeStudents)
- PipelineStats (status -> count mapping)
- SourceStats (source -> count mapping)

**File to modify:** `chore-app/frontend/src/api/client.ts` — no changes needed (baseURL and interceptor stay the same)

### Step 11: Frontend — layout and routing

**File to modify:** `chore-app/frontend/src/App.tsx`

- Update routes: remove Chores, add Dashboard (/dashboard as index), Leads (/leads), LeadDetails (/leads/:id), Tasks (/tasks), TrialLessons (/trial-lessons), Students (/students), StudentDetails (/students/:id), Groups (/groups)
- Keep: Login, Calendar, Team routes
- Default route redirects to /dashboard

**File to modify:** `chore-app/frontend/src/components/Layout.tsx`

- Update sidebar nav items: דשבורד, לידים, משימות, שיעורי ניסיון, יומן, תלמידים, קבוצות, צוות
- Update header title to "INNOKIDS"
- Update icons per nav item
- Dashboard is first item

### Step 12: Frontend — shared components

**Files to create:**
- `chore-app/frontend/src/components/StatusBadge.tsx` — reusable badge component using CSS classes from cmps/badge.css, maps status string to CSS variable color
- `chore-app/frontend/src/components/ActivityTimeline.tsx` — chronological list of ActivityLog entries with icons per type, relative timestamps
- `chore-app/frontend/src/components/ConfirmDialog.tsx` — reusable confirmation modal (title, message, confirm/cancel buttons)
- `chore-app/frontend/src/components/LeadModal.tsx` — create/edit lead form (fullName, phone, email, source, learningFormat, branch, assignedToId, notes). Uses react-hook-form, fetches users for assignee dropdown
- `chore-app/frontend/src/components/TaskModal.tsx` — create/edit task form (title, description, type, priority, dueDate, assignedToId, leadId?, studentId?). Fetches users, leads, students for dropdowns
- `chore-app/frontend/src/components/TrialLessonModal.tsx` — schedule trial form (leadId, groupId?, scheduledAt, teacherId, notes). Fetches leads, groups, users
- `chore-app/frontend/src/components/StudentModal.tsx` — create student form (childName, childBirthYear, learningFormat, branch, groupId?). Used in lead conversion flow and standalone
- `chore-app/frontend/src/components/GroupModal.tsx` — create/edit group form (name, type, ageRange, learningFormat, branch, dayOfWeek, time, maxCapacity, teacherId)

**Files to keep (modify):**
- `chore-app/frontend/src/components/NotificationBell.tsx` — no changes needed (already Hebrew, already polls)
- `chore-app/frontend/src/components/Layout.tsx` — modified in step 11

**Files to delete:**
- `chore-app/frontend/src/components/ChoreModal.tsx`
- `chore-app/frontend/src/components/CompleteModal.tsx`

### Step 13: Frontend — pages

**Files to create:**
- `chore-app/frontend/src/pages/Dashboard.tsx` — stats cards (new leads, trials, conversions, active students), pipeline summary, source breakdown, upcoming follow-ups, recent activity feed
- `chore-app/frontend/src/pages/Leads.tsx` — table view with filters (status, source, assignedTo, learningFormat, search). Columns: name, phone, source badge, status badge, assigned to, next follow-up, last contact. Click row navigates to details. "ליד חדש" button opens LeadModal
- `chore-app/frontend/src/pages/LeadDetails.tsx` — header with name/phone/status, info card, status change dropdown, activity timeline, linked trial lessons, linked tasks, notes section, convert button, reopen button
- `chore-app/frontend/src/pages/Tasks.tsx` — table with filters (status, type, assignee, priority). Columns: title, type badge, priority, due date, linked lead/student, assigned to. Quick complete, "משימה חדשה" button. Filter tabs: הכל/ממתינות/הושלמו
- `chore-app/frontend/src/pages/TrialLessons.tsx` — table with filters (status, date range, teacher). Columns: lead name, scheduled date, group, teacher, status. Quick status change. "שיעור ניסיון חדש" button
- `chore-app/frontend/src/pages/Students.tsx` — table with filters (status, group, learningFormat, search). Columns: child name, parent name, group, format, branch, enrolled date, status
- `chore-app/frontend/src/pages/StudentDetails.tsx` — header with child name/parent info/status, group assignment, activity log, notes
- `chore-app/frontend/src/pages/Groups.tsx` — card grid with filters (status, format, branch). Each card: name, type, schedule, capacity, teacher, status. "קבוצה חדשה" button (admin). Click opens details with student list

**Files to modify:**
- `chore-app/frontend/src/pages/Calendar.tsx` — replace chore events with CRM events: trial lessons (blue from --color-event-trial), follow-ups (orange from --color-event-followup), group sessions (green from --color-event-group), overdue (red from --color-event-overdue). Fetch from multiple endpoints. Update legend labels.
- `chore-app/frontend/src/pages/Team.tsx` — update role labels (מנהל/צוות instead of ADMIN/MEMBER), add status field to user cards, minor text updates
- `chore-app/frontend/src/pages/Login.tsx` — update branding from "מנהל תורנויות" to "INNOKIDS", update subtitle

**Files to delete:**
- `chore-app/frontend/src/pages/Chores.tsx`
- `chore-app/frontend/src/pages/Reports.tsx` (replaced by Dashboard)

### Step 14: Frontend — auth hook update

**File to modify:** `chore-app/frontend/src/hooks/useAuth.tsx`

- Update role check: `isAdmin` checks for "ADMIN" (same), but also add `isStaff` for future use
- No other changes needed

## Validation

After each step, verify:

1. **After Step 4 (schema):** `npx prisma generate` succeeds, `npx prisma migrate dev` creates tables without errors
2. **After Step 5-8 (backend):** `npx tsc --noEmit` passes with zero errors from `chore-app/backend/`
3. **After Step 8 (entry point):** Backend starts on port 4000, seeds admin user, cron job registers
4. **After Step 8:** Test endpoints manually:
   - POST /api/auth/login with admin credentials → returns token
   - POST /api/lead with token → creates lead
   - POST /api/lead-intake/webhook/website with API key → creates lead via webhook
   - Duplicate phone detection works
   - GET /api/lead → lists leads
   - POST /api/lead/:id/convert → creates student
5. **After Step 9-13 (frontend):** `npx tsc -b --noEmit` passes with zero errors from `chore-app/frontend/`
6. **After Step 13:** `npx vite build` succeeds
7. **After Step 13:** Manual smoke test in browser:
   - Login as admin
   - Dashboard loads with stats
   - Create a lead → appears in leads table
   - Open lead details → activity timeline shows creation
   - Change lead status → timeline updates
   - Schedule trial lesson for lead → appears in trial lessons page and calendar
   - Complete trial → lead status updates
   - Convert lead to student → student appears in students page
   - Create a group → assign student to group
   - Create a task linked to a lead → appears in tasks page
   - Notifications appear for relevant actions
   - Team page shows users with מנהל/צוות roles

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Prisma migration on existing dev.db fails | Blocks development | Delete dev.db and migration history, start fresh |
| Express v5 route param handling differences | Runtime errors on /:id routes | Test each route after creation |
| FullCalendar with multiple event sources | Calendar rendering issues | Test with real data after integration |
| Large number of new files (30+) | Merge conflicts, missed integrations | Build in order, validate at each step |
| CSS variable approach alongside Tailwind | Potential conflicts or unused styles | Keep CSS variables for tokens only, Tailwind for layout/utilities |
| SQLite JSON field limitations | Metadata/rawPayload queries limited | Acceptable for V1; JSON fields used for logging, not querying |

## Rollout Order

Execute steps sequentially:

1. **Step 1** — Documentation updates (no code risk)
2. **Step 2** — Branch setup
3. **Step 3** — Dependencies
4. **Step 4** — Database schema (breaking change — fresh migration)
5. **Step 5** — Backend utilities (requestId, phoneNormalizer, apiKey middleware)
6. **Step 6** — Backend services (business logic layer)
7. **Step 7** — Backend routes (API endpoints)
8. **Step 8** — Backend entry point (wire everything together)
9. **Checkpoint: backend validation** — start server, test endpoints
10. **Step 9** — Frontend CSS refactor
11. **Step 10** — Frontend types
12. **Step 11** — Frontend routing and layout
13. **Step 12** — Frontend shared components
14. **Step 13** — Frontend pages
15. **Step 14** — Frontend auth hook
16. **Checkpoint: frontend validation** — build, manual smoke test
17. **Final: full integration test** — end-to-end flow in browser

## Rollback

- All work is on `feat/crm-core` branch — main branch is untouched
- If the refactor fails mid-way: `git checkout main` restores the chore-app
- Database: dev.db is disposable (SQLite file), can be regenerated from any schema state via `prisma migrate dev`
- No production data exists — this is a fresh development project
- If a specific step breaks: fix on the branch, do not force-merge to main
