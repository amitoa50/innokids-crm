# INNOKIDS CRM Core — Design Spec

## Overview

Refactor the existing chore-app into a CRM system for INNOKIDS, a coding school for kids and teens operating online and in physical community centers. This spec covers CRM Core (Phase 1) — the foundation for lead management, sales pipeline, student/group operations, tasks, and integration-ready lead intake.

## Product Vision

Replace external paid tools with a single internal operating system that manages leads, sales pipeline, parent communication follow-ups, trial lesson coordination, student enrollment, and internal task management.

## Target Users

- **Admin** — full system access: leads, students, groups, tasks, reports, users, settings
- **Staff** — works leads, follow-ups, trial lessons, student/group management; no system-level settings
- **Teacher** (future V2 role) — limited access to own groups/students/trials

## Phase Strategy

1. **CRM Core** (this spec) — data model, pipeline, CRUD, tasks, calendar, manual logging, webhook-ready lead intake
2. **Communication Engine** (future) — WhatsApp Business API, message sending, templates, conversation history
3. **Automation Engine** (future) — trigger-based flows, sequences, scheduling, execution
4. **Dashboard & Reports** (future enhancement) — deeper analytics on top of CRM data

---

## Data Model

### User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| email | string | yes | unique |
| name | string | yes | |
| password | string | yes | bcrypt hashed |
| role | string | yes | ADMIN, STAFF |
| status | string | yes | ACTIVE, INACTIVE |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

### Lead

The lead represents the parent/customer who left details. Child details are captured only at conversion to Student.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| fullName | string | yes | |
| phone | string | yes | primary dedup key |
| phoneNormalized | string | auto | normalized format for dedup (+972...) |
| email | string | no | |
| source | string | yes | FACEBOOK, INSTAGRAM, WEBSITE, MANUAL, OTHER |
| campaignName | string | no | form/campaign name from ad platform |
| status | string | yes | NEW, CONTACTED, NO_RESPONSE, TRIAL_SCHEDULED, TRIAL_COMPLETED, FOLLOW_UP_AFTER_TRIAL, CONVERTED, CLOSED |
| assignedToId | FK->User | no | staff member working this lead |
| nextFollowUpDate | datetime | no | drives follow-up reminders |
| lastContactDate | datetime | no | updated on each communication |
| learningFormat | string | no | ONLINE, IN_PERSON, UNKNOWN |
| branch | string | no | physical location name |
| closedReason | string | no | brief reason when moved to CLOSED |
| notes | text | no | free-text |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

**Dedup rules:**
- Phone number is the primary dedup key
- Normalization: strip spaces/dashes/parentheses, convert Israeli formats to +972 prefix
- On duplicate detection:
  - If existing lead is CLOSED: reopen it, set status to NEW, log activity
  - If existing lead is active: update/merge fields, log activity, do not create duplicate
  - Always log the intake attempt in LeadIntake table

### Student

Created when a lead converts. Links back to the originating lead.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| leadId | FK->Lead | yes | the parent who converted |
| childName | string | yes | |
| childBirthYear | int | no | |
| learningFormat | string | yes | ONLINE, IN_PERSON |
| branch | string | no | |
| status | string | yes | ACTIVE, INACTIVE, PAUSED |
| groupId | FK->Group | no | assigned later |
| enrolledAt | datetime | auto | |
| notes | text | no | |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

### Group

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| name | string | yes | e.g. "Scratch Beginners - Sunday 16:00" |
| type | string | yes | program type (Scratch, Python, Robotics, etc.) |
| ageRange | string | no | e.g. "8-10" |
| learningFormat | string | yes | ONLINE, IN_PERSON |
| branch | string | no | |
| dayOfWeek | string | no | |
| time | string | no | |
| maxCapacity | int | no | |
| teacherId | FK->User | no | |
| status | string | yes | ACTIVE, FULL, ARCHIVED |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

### TrialLesson

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| leadId | FK->Lead | yes | |
| groupId | FK->Group | no | trial in a specific group |
| scheduledAt | datetime | yes | |
| status | string | yes | SCHEDULED, COMPLETED, NO_SHOW, CANCELLED |
| outcome | text | no | notes on how it went |
| teacherId | FK->User | no | |
| notes | text | no | |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

### Task

Internal follow-up / to-do items for staff.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| title | string | yes | |
| description | text | no | |
| type | string | yes | FOLLOW_UP, CALL, GENERAL, TRIAL_REMINDER |
| priority | string | yes | LOW, MEDIUM, HIGH |
| status | string | yes | PENDING, COMPLETED |
| dueDate | datetime | no | |
| assignedToId | FK->User | yes | |
| leadId | FK->Lead | no | linked to a lead |
| studentId | FK->Student | no | linked to a student |
| completedAt | datetime | no | |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto | |

### ActivityLog

Tracks all actions on leads/students for timeline views and future automation triggers.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| type | string | yes | STATUS_CHANGE, NOTE_ADDED, CALL_LOGGED, TASK_CREATED, TRIAL_SCHEDULED, TRIAL_COMPLETED, LEAD_CONVERTED, LEAD_REOPENED, LEAD_RECEIVED_FROM_SOURCE |
| description | string | yes | human-readable summary in Hebrew |
| leadId | FK->Lead | no | |
| studentId | FK->Student | no | |
| performedById | FK->User | no | null for system actions (webhooks) |
| metadata | JSON | no | flexible data (old/new status, source, etc.) |
| createdAt | datetime | auto | |

### LeadIntake

Webhook/integration audit log.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| source | string | yes | facebook, instagram, website, etc. |
| rawPayload | JSON | yes | original data as received |
| status | string | yes | SUCCESS, DUPLICATE_MERGED, DUPLICATE_REOPENED, FAILED |
| leadId | FK->Lead | no | the lead created/updated |
| errorMessage | string | no | if processing failed |
| createdAt | datetime | auto | |

### Notification

Kept from existing system, adapted for CRM context.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | auto | |
| userId | FK->User | yes | recipient |
| message | string | yes | Hebrew notification text |
| read | boolean | yes | default false |
| createdAt | datetime | auto | |

---

## API Routes

All routes use singular entity names per naming-rules.md.

All non-2xx responses follow the error shape from error-handling-rules.md:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone number is required",
    "details": {}
  },
  "requestId": "uuid-v4"
}
```

Every response includes `requestId` header and field via middleware.

### Auth — `/api/auth`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/login` | Login with email/password, return JWT + user | Public |
| POST | `/register` | Register new account | Public |

### Lead — `/api/lead`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List leads, filters: status, source, assignedToId, search, learningFormat | All |
| GET | `/:id` | Lead details with activity log, tasks, trial lessons | All |
| POST | `/` | Create lead manually (runs dedup check) | All |
| PUT | `/:id` | Update lead fields | All |
| PUT | `/:id/status` | Change pipeline status (creates ActivityLog entry) | All |
| PUT | `/:id/assign` | Assign staff member | All |
| POST | `/:id/convert` | Convert lead to Student (body: childName, childBirthYear, learningFormat, branch, groupId?), set status CONVERTED | All |
| POST | `/:id/reopen` | Reopen a CLOSED lead back to NEW | All |
| POST | `/:id/note` | Add a note (creates ActivityLog entry) | All |

### Lead Intake — `/api/lead-intake`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/webhook/:source` | Receive leads from external platforms | API key |
| GET | `/log` | View integration logs | Admin |

Webhook auth: `x-api-key` header or `?api_key=` query param, validated against `WEBHOOK_API_KEY` env var.

### Student — `/api/student`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List students, filters: status, groupId, learningFormat, search | All |
| GET | `/:id` | Student details with group, lead link, activity | All |
| POST | `/` | Create student (usually via lead conversion) | All |
| PUT | `/:id` | Update student | All |

### Group — `/api/group`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List groups, filters: status, learningFormat, branch | All |
| GET | `/:id` | Group details with students list | All |
| POST | `/` | Create group | Admin |
| PUT | `/:id` | Update group | Admin |
| POST | `/:id/student` | Add student to group | All |
| DELETE | `/:id/student/:studentId` | Remove student from group | All |

### Trial Lesson — `/api/trial-lesson`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List trial lessons, filters: status, date range, teacherId | All |
| POST | `/` | Schedule trial (linked to lead, optionally to group) | All |
| PUT | `/:id` | Update trial lesson | All |
| PUT | `/:id/status` | Change status (completed, no-show, cancelled) | All |

### Task — `/api/task`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List tasks, filters: status, assignedToId, type, priority, dueDate | All |
| POST | `/` | Create task (optionally linked to lead/student) | All |
| PUT | `/:id` | Update task | All |
| PUT | `/:id/complete` | Mark task complete | All |
| DELETE | `/:id` | Delete task | All |

### Report — `/api/report`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/dashboard` | Key metrics: new leads, conversions, trials, active students | All |
| GET | `/pipeline` | Lead count per pipeline stage | All |
| GET | `/source` | Leads by source breakdown | All |
| GET | `/staff-performance` | Tasks completed, leads handled per staff | Admin |

### User — `/api/user`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List users (exclude password) | Admin |
| POST | `/` | Create user | Admin |
| PUT | `/:id` | Update user | Admin |
| DELETE | `/:id` | Delete user (not self) | Admin |

### Notification — `/api/notification`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List notifications for current user | All |
| PUT | `/:id/read` | Mark notification as read | All |

---

## Lead Intake / Webhook Architecture

### Flow

1. External platform sends POST to `/api/lead-intake/webhook/:source`
2. Validate API key
3. Log raw payload to LeadIntake table (always, before processing)
4. Route to source-specific normalizer (`normalizer/facebook.ts`, `normalizer/website.ts`, etc.)
5. Normalizer extracts: fullName, phone, email, campaignName
6. Validate required fields (phone is mandatory)
7. Normalize phone number (strip formatting, convert to +972 format)
8. Dedup check by phoneNormalized:
   - No match: create new Lead with status NEW
   - Match + CLOSED: reopen lead, set NEW, log LEAD_REOPENED
   - Match + active: merge fields, log activity, update LeadIntake as DUPLICATE_MERGED
9. Update LeadIntake record with result (SUCCESS / DUPLICATE_MERGED / DUPLICATE_REOPENED / FAILED)
10. Create notification for admin/assigned staff
11. Create ActivityLog entry: LEAD_RECEIVED_FROM_SOURCE

### Normalizer Interface

```
interface NormalizedLead {
  fullName: string
  phone: string
  email?: string
  campaignName?: string
  learningFormat?: string
  branch?: string
}
```

Each source gets its own normalizer file under `src/services/normalizer/`. Adding a new source = adding a new normalizer file. Core intake logic stays untouched.

### Phone Normalization

Utility function `normalizePhone(raw: string): string`:
- Strip spaces, dashes, parentheses, dots
- Israeli format handling:
  - `050-1234567` -> `+972501234567`
  - `0501234567` -> `+972501234567`
  - `+972501234567` -> `+972501234567`
  - `972501234567` -> `+972501234567`
- Store both `phone` (original display format) and `phoneNormalized` (for dedup)

---

## Frontend Pages

### Sidebar Navigation (RTL, Hebrew)

Order reflects daily priority:

```
INNOKIDS
────────
📊 דשבורד           → /dashboard
📋 לידים             → /leads
✅ משימות            → /tasks
🧪 שיעורי ניסיון     → /trial-lessons
📅 יומן              → /calendar
🎓 תלמידים           → /students
👥 קבוצות            → /groups
👤 צוות              → /team (admin only)
```

Lead details (`/leads/:id`) and student details (`/students/:id`) are accessed by clicking, not from sidebar.

### Pages

**Dashboard (`/dashboard`)** — Daily command center
- Stats cards: new leads this month, trials scheduled, conversions, active students
- Pipeline summary (leads per stage)
- Leads by source breakdown
- Upcoming follow-ups list (today/overdue)
- Recent activity feed
- Staff performance summary (admin only)

**Leads (`/leads`)** — Primary working screen
- Table view (V1 primary view, Kanban deferred to later)
- Columns: name, phone, source, status, assigned to, next follow-up, last contact, created
- Filters: status, source, assigned staff, learning format, search by name/phone
- Status badges with pipeline colors (via CSS variables)
- Overdue follow-ups highlighted
- "ליד חדש" button
- Click row -> lead details page

**Lead Details (`/leads/:id`)**
- Header: name, phone (click-to-copy), email, status badge, assigned staff
- Status change dropdown
- Info card: source, campaign, learning format, branch, dates
- Activity timeline (chronological log of all actions)
- Linked trial lessons section
- Linked tasks section
- Notes section with add-note form
- Convert to student button
- Reopen button (when CLOSED)

**Tasks (`/tasks`)**
- Table with filters: status, type, assignee, priority
- Columns: title, type badge, priority, due date, linked lead/student, assigned to
- Quick complete button
- "משימה חדשה" button
- Filter tabs: הכל, ממתינות, הושלמו
- Overdue tasks highlighted

**Trial Lessons (`/trial-lessons`)**
- Table view
- Columns: lead name, scheduled date/time, group, teacher, status
- Filters: status, date range, teacher
- Quick status change buttons
- "שיעור ניסיון חדש" button

**Calendar (`/calendar`)**
- FullCalendar month/week view, RTL + Hebrew locale
- Shows: trial lessons (blue), follow-ups (orange), group sessions (green), overdue items (red)
- Click to view/edit details

**Students (`/students`)**
- Table/card view
- Columns: child name, parent name, group, learning format, branch, enrolled date, status
- Filters: status, group, learning format, search
- Click row -> student details

**Student Details (`/students/:id`)**
- Header: child name, parent info (from linked lead), group, status
- Parent contact info
- Group assignment
- Activity log
- Notes

**Groups (`/groups`)**
- Card grid
- Each card: name, type, day + time, capacity, teacher, status
- Filters: status, learning format, branch
- Click -> group details with student list
- "קבוצה חדשה" button (admin only)

**Team (`/team`)** — Admin only
- Same structure as current, Hebrew labels
- Roles: מנהל / צוות

### Shared Components

- **LeadModal** — create/edit lead form
- **TaskModal** — create/edit task with lead/student linking
- **TrialLessonModal** — schedule trial, link to lead + group
- **StudentModal** — create student (conversion flow or standalone)
- **GroupModal** — create/edit group
- **StatusBadge** — reusable pipeline status component, colors from CSS variables
- **ActivityTimeline** — chronological activity log
- **NotificationBell** — kept from existing, adapted messages
- **ConfirmDialog** — reusable confirmation modal

---

## CSS Architecture

Per style-rules.md, the CSS structure must be:

```
src/
  styles/
    main.css          → entry point, imports below
    setup/
      variables.css   → CSS custom properties for tokens
      reset.css       → base resets if needed beyond Tailwind
    basics/
      typography.css  → base text styles
      layout.css      → base layout patterns
    cmps/
      badge.css       → status badge styles
      timeline.css    → activity timeline styles
      modal.css       → modal overlay styles
      table.css       → table enhancements
```

### Design Tokens (CSS Variables)

```css
:root {
  /* Brand */
  --color-brand-primary: #4f46e5;
  --color-brand-light: #eef2ff;

  /* Pipeline status colors */
  --color-status-new: #3b82f6;
  --color-status-contacted: #8b5cf6;
  --color-status-no-response: #f59e0b;
  --color-status-trial-scheduled: #06b6d4;
  --color-status-trial-completed: #10b981;
  --color-status-follow-up: #f97316;
  --color-status-converted: #22c55e;
  --color-status-closed: #6b7280;

  /* Priority colors */
  --color-priority-high: #ef4444;
  --color-priority-medium: #f59e0b;
  --color-priority-low: #6b7280;

  /* Calendar event colors */
  --color-event-trial: #3b82f6;
  --color-event-followup: #f97316;
  --color-event-group: #22c55e;
  --color-event-overdue: #ef4444;

  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Border radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

Status badge styling uses CSS `text-transform` for label casing — no JS string manipulation.

---

## Error Handling

Per error-handling-rules.md:

### RequestId Middleware

Every request gets a UUID v4 assigned via middleware. The `requestId` is:
- Attached to the response as `x-request-id` header
- Included in every JSON response body
- Logged with every server-side log entry

### Error Response Shape

```json
{
  "error": {
    "code": "DUPLICATE_LEAD",
    "message": "ליד עם מספר טלפון זה כבר קיים במערכת",
    "details": {
      "existingLeadId": 42,
      "phone": "+972501234567"
    }
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Status Code Usage

| Code | Usage |
|------|-------|
| 400 | Malformed input (missing required fields, bad format) |
| 401 | Missing or invalid JWT / API key |
| 403 | Authenticated but insufficient role |
| 404 | Entity not found |
| 409 | State conflict (e.g., lead already converted) |
| 422 | Semantic validation (e.g., invalid status transition) |
| 500 | Unexpected internal errors |

---

## Backend Structure

```
chore-app/backend/src/
  index.ts                    # Express app, CORS, routes, cron, admin seed
  lib/
    prisma.ts                 # PrismaClient singleton
    requestId.ts              # requestId middleware
    phoneNormalizer.ts         # phone normalization utility
  middleware/
    auth.ts                   # JWT verify + role guard
    apiKey.ts                 # webhook API key validation
  routes/
    auth.ts
    lead.ts
    leadIntake.ts
    student.ts
    group.ts
    trialLesson.ts
    task.ts
    report.ts
    user.ts
    notification.ts
  services/
    lead.service.ts           # lead business logic (dedup, conversion, reopen)
    student.service.ts
    group.service.ts
    trialLesson.service.ts
    task.service.ts
    activityLog.service.ts    # activity logging
    notification.service.ts
    email.ts                  # kept, optional Gmail SMTP
    normalizer/
      facebook.ts
      instagram.ts
      website.ts
      default.ts
  prisma/
    schema.prisma
```

---

## Frontend Structure

```
chore-app/frontend/src/
  App.tsx
  main.tsx
  styles/
    main.css
    setup/
      variables.css
    basics/
      typography.css
    cmps/
      badge.css
      timeline.css
  api/
    client.ts
  hooks/
    useAuth.tsx
  types.ts
  pages/
    Login.tsx
    Dashboard.tsx
    Leads.tsx
    LeadDetails.tsx
    Tasks.tsx
    TrialLessons.tsx
    Calendar.tsx
    Students.tsx
    StudentDetails.tsx
    Groups.tsx
    Team.tsx
  components/
    Layout.tsx
    NotificationBell.tsx
    LeadModal.tsx
    TaskModal.tsx
    TrialLessonModal.tsx
    StudentModal.tsx
    GroupModal.tsx
    StatusBadge.tsx
    ActivityTimeline.tsx
    ConfirmDialog.tsx
```

---

## Cron Jobs

- **Overdue follow-up check** (replaces existing overdue chore check): daily at midnight, find leads with `nextFollowUpDate < now` and status not CLOSED/CONVERTED, create notification for assigned staff
- **Future**: automation trigger cron (Phase 3)

---

## What Gets Removed

- `Chore` model and all chore-related code
- `routes/chores.ts`
- `services/recurrence.ts`
- `ChoreModal.tsx`, `CompleteModal.tsx`
- `pages/Chores.tsx` (replaced by Tasks)
- All chore-related types

## What Gets Kept and Adapted

- Authentication system (JWT + bcrypt)
- Layout component (sidebar, header, notification bell)
- Protected route wrappers
- Team page structure
- Calendar page (new event types)
- Reports page structure (new metrics)
- Notification infrastructure
- Axios client + TanStack Query patterns
- PrismaClient singleton
- Express + Prisma + TypeScript stack
- Tailwind + lucide-react + sonner

---

## Glossary Updates Required

Before implementation, add to `agent-files/.doc/glossary.md`:

- `lead` — parent/customer who left contact details, tracked through sales pipeline
- `student` — enrolled child, created when a lead converts
- `group` — class group for a specific program, age range, and schedule
- `trial-lesson` — trial/demo class scheduled for a lead before enrollment
- `task` — internal follow-up or to-do item for staff
- `activity-log` — chronological record of actions on leads/students
- `lead-intake` — webhook-based system for receiving leads from external platforms

---

## Documentation Updates Required

- **CLAUDE.md** — update project description, structure, and commands for CRM
- **architecture.md** — fill with INNOKIDS CRM architecture
- **product-definition.md** — fill with INNOKIDS product vision and scope
- **database-rules.md** — document Prisma as source of truth (deviation from schema.sql convention)
