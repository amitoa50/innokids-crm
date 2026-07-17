# Plan 015 — Service Hardening (Automation Engine, Transactions, Integrity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close package 2 of the 2026-07-15 review — the automation engine and service-layer correctness bugs that survive the deploy-blockers fixes: a single bad outbox row halts the whole dispatch batch and sticks in SENDING forever, missing templates get "sent", repeated trial-status updates duplicate side effects, trials can be scheduled in the past or for closed leads, lead conversion races can create two students, and group membership/capacity state can drift.

**Architecture:** Pure service/route-layer fixes on the existing stack. One Prisma schema change (`Student.leadId @unique`) with a migration. Every fix lands TDD-style using the supertest + throwaway-SQLite infrastructure from plan 014. No new dependencies.

**Tech Stack:** Express v5 + TypeScript, Prisma v5 + SQLite, Vitest + supertest. Conventions: no trailing semicolons, error shape `{ error: { code, message }, requestId }`, PrismaClient singleton, singular route names.

**Out of scope:** whatsappConsent default (package 3 — owner decision), dashboards/cron-dedup/rate-limiting/pagination/frontend (package 4).

---

## Context for a zero-context engineer

- Backend: `chore-app/backend/` (all backend commands run there). Tests: `npm test` (Vitest; 66 passing at branch start). Helpers: `test/helpers/db.ts` (`resetDb`, `createAdmin`, `createStaff`, `createLead`, `createTrial`, `createScheduledRow`, `logWhatsAppMessage`, `prisma`), `test/helpers/auth.ts` (`tokenFor`).
- The automation outbox: `ScheduledMessage` rows (statuses PENDING → SENDING → SENT / FAILED / CANCELLED) drained by `dispatchDue()` in `src/services/automation.service.ts`, invoked by a 5-min cron in `index.ts`. `ScheduledMessage` HAS `updatedAt DateTime @updatedAt` — you may backdate it explicitly in test inserts (an explicit value overrides `@updatedAt` on create).
- `test/setup.ts` sets mock provider + test DB before app import. The mock provider's `sendTemplate` never throws — to force a mid-loop throw deterministically, use a row whose `variables` column holds invalid JSON (`JSON.parse` at automation.service.ts line ~119 throws).
- Lead pipeline transitions are guarded by `src/lib/pipeline.ts` (`canTransition`); `setLeadStatus(..., { system: true })` silently returns the lead unchanged on an illegal move.
- Work on a branch: from repo root `git checkout master && git pull && git checkout -b feat/service-hardening`.

---

### Task 1: Automation dispatch — per-row isolation + stale-claim reclaim

**Files:**
- Modify: `chore-app/backend/src/services/automation.service.ts`
- Modify: `chore-app/backend/test/helpers/db.ts` (add `updatedAt` passthrough to `createScheduledRow`)
- Modify: `chore-app/backend/test/automation.engine.test.ts` (append a describe block)

- [ ] **Step 1: Extend the test helper**

In `test/helpers/db.ts`, add `updatedAt?: Date` to `ScheduledRowParams` and pass it through in the `create` call:
```ts
      createdAt: params.createdAt ?? new Date(Date.now() - 60 * 60 * 1000),
      ...(params.updatedAt && { updatedAt: params.updatedAt })
```
(add the field to the interface too: `updatedAt?: Date`)

- [ ] **Step 2: Write the failing tests**

Append to `test/automation.engine.test.ts` (reuse its existing imports/helpers — read the file's top first and follow its patterns; it already imports `dispatchDue`, `prisma`, `resetDb`, `createLead`, `createScheduledRow`):
```ts
describe("dispatch resilience", () => {
  it("a row that throws is FAILED and does not halt the rest of the batch", async () => {
    const lead = await createLead()
    const bad = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NEW_LEAD_WELCOME",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "new_lead_welcome"
    })
    // corrupt the variables JSON so JSON.parse throws mid-loop
    await prisma.scheduledMessage.update({ where: { id: bad.id }, data: { variables: "{not-json" } })
    const good = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NEW_LEAD_FOLLOW_UP",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "new_lead_follow_up"
    })

    await dispatchDue()

    const badAfter = await prisma.scheduledMessage.findUnique({ where: { id: bad.id } })
    const goodAfter = await prisma.scheduledMessage.findUnique({ where: { id: good.id } })
    expect(badAfter!.status).toBe("FAILED")
    expect(badAfter!.failureReason).toContain("DISPATCH_ERROR")
    expect(goodAfter!.status).toBe("SENT")
  })

  it("reclaims a stale SENDING row and sends it", async () => {
    const lead = await createLead()
    const stale = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NEW_LEAD_WELCOME",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "new_lead_welcome",
      status: "SENDING",
      updatedAt: new Date(Date.now() - 30 * 60 * 1000)
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUnique({ where: { id: stale.id } })
    expect(after!.status).toBe("SENT")
  })

  it("leaves a fresh SENDING claim alone", async () => {
    const lead = await createLead()
    const fresh = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NEW_LEAD_WELCOME",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "new_lead_welcome",
      status: "SENDING"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUnique({ where: { id: fresh.id } })
    expect(after!.status).toBe("SENDING")
  })
})
```
Note: the trigger/template names above must match seeded automation registry entries — check `src/lib/automationSeed.ts` / existing tests for the real names and adjust so the rows pass the registry + template guards (existing tests show which names are valid and APPROVED after `resetDb()`; if `new_lead_follow_up` isn't the seeded name, use the names the existing tests use).

Run: `npx vitest run test/automation.engine.test.ts`
Expected: throw-test FAILS (bad row stuck SENDING, good row never dispatched); reclaim-test FAILS (stays SENDING); fresh-claim test passes.

- [ ] **Step 3: Implement in `automation.service.ts`**

At the top of the file add:
```ts
// A SENDING claim older than this is considered orphaned (process died mid-send)
// and is returned to PENDING on the next tick.
const STALE_CLAIM_MINUTES = 15
```

At the START of `dispatchDue()` (before the `findMany`), add:
```ts
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60 * 1000)
  await prisma.scheduledMessage.updateMany({
    where: { status: "SENDING", updatedAt: { lt: staleBefore } },
    data: { status: "PENDING" }
  })
```

Wrap the per-row body (everything after the successful claim, i.e. after `if (claim.count !== 1) continue`) in try/catch:
```ts
    try {
      // ... existing row processing unchanged ...
    } catch (err) {
      const reason = `DISPATCH_ERROR: ${err instanceof Error ? err.message : String(err)}`
      console.error(`[automation] row ${row.id} failed:`, err)
      try {
        await finalize(row.id, "FAILED", reason)
        await notifyAdmins(`הודעה אוטומטית נכשלה (שגיאת מערכת) — שורה ${row.id}`)
      } catch (finalizeErr) {
        console.error(`[automation] could not finalize row ${row.id}:`, finalizeErr)
      }
    }
```
Keep all existing `continue`-based guard logic unchanged inside the try (a `continue` inside try/catch works normally in a for-loop).

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/automation.engine.test.ts` → all pass (existing + 3 new)
Run: `npm test` → all pass (69 expected)

- [ ] **Step 5: Commit**

```bash
git add src/services/automation.service.ts test/helpers/db.ts test/automation.engine.test.ts
git commit -m "fix(automation): isolate row failures, reclaim orphaned SENDING claims" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: sendWhatsApp rejects a missing template

**Files:**
- Modify: `chore-app/backend/src/services/whatsapp/send.service.ts:31-36`
- Modify: `chore-app/backend/src/routes/lead.ts` (the `sendErrorStatus` map)
- Create: `chore-app/backend/test/sendTemplate.test.ts`

Today `if (tpl && tpl.status !== "APPROVED")` means a template that doesn't exist at all skips the check and `[template:name]` is sent to the provider.

- [ ] **Step 1: Write the failing test**

Create `test/sendTemplate.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import { sendWhatsApp } from "../src/services/whatsapp/send.service"
import { prisma, resetDb, createLead } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("sendWhatsApp template validation", () => {
  it("rejects a template that does not exist", async () => {
    const lead = await createLead()
    const result = await sendWhatsApp(lead.id, { templateName: "no_such_template", variables: [] })
    expect(result).toEqual({ error: "TEMPLATE_NOT_FOUND" })
    const messages = await prisma.message.findMany()
    expect(messages.length).toBe(0)
  })

  it("still rejects an unapproved template", async () => {
    const lead = await createLead()
    const tpl = await prisma.messageTemplate.findFirst()
    await prisma.messageTemplate.update({ where: { id: tpl!.id }, data: { status: "DRAFT" } })
    const result = await sendWhatsApp(lead.id, { templateName: tpl!.name, variables: [] })
    expect(result).toEqual({ error: "TEMPLATE_NOT_APPROVED" })
  })
})
```
Run: `npx vitest run test/sendTemplate.test.ts` — first test FAILS (send goes through, message logged).

- [ ] **Step 2: Implement**

In `send.service.ts` replace:
```ts
    const tpl = await prisma.messageTemplate.findUnique({ where: { name: params.templateName } })
    if (tpl && tpl.status !== "APPROVED") return { error: "TEMPLATE_NOT_APPROVED" as const }
    const language = params.language || tpl?.language || "he"
    bodyText = tpl ? interpolate(tpl.body, params.variables) : `[template:${params.templateName}]`
```
with:
```ts
    const tpl = await prisma.messageTemplate.findUnique({ where: { name: params.templateName } })
    if (!tpl) return { error: "TEMPLATE_NOT_FOUND" as const }
    if (tpl.status !== "APPROVED") return { error: "TEMPLATE_NOT_APPROVED" as const }
    const language = params.language || tpl.language
    bodyText = interpolate(tpl.body, params.variables)
```

In `src/routes/lead.ts`, find the `sendErrorStatus` map (grep `sendErrorStatus`) and add `TEMPLATE_NOT_FOUND: 404` alongside the existing entries (match the map's style).

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/sendTemplate.test.ts` → 2 passed
Run: `npm test` → all pass (71 expected). If any existing test relied on the `[template:x]` fallback, STOP and report DONE_WITH_CONCERNS with the failing test — do not weaken the fix.

- [ ] **Step 4: Commit**

```bash
git add src/services/whatsapp/send.service.ts src/routes/lead.ts test/sendTemplate.test.ts
git commit -m "fix(whatsapp): reject sends for templates that do not exist" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: updateTrialStatus is idempotent

**Files:**
- Modify: `chore-app/backend/src/services/trialLesson.service.ts` (`updateTrialStatus`)
- Create: `chore-app/backend/test/trialStatus.test.ts`

Today calling COMPLETED (or NO_SHOW) twice re-runs every side effect: duplicate follow-up tasks, duplicate activity rows, repeated lead updates.

- [ ] **Step 1: Write the failing test**

Create `test/trialStatus.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import { updateTrialStatus } from "../src/services/trialLesson.service"
import { prisma, resetDb, createAdmin, createLead, createTrial } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("updateTrialStatus idempotency", () => {
  it("repeating COMPLETED does not duplicate side effects", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ assignedToId: admin.id, status: "TRIAL_SCHEDULED" })
    const trial = await createTrial(lead.id)

    await updateTrialStatus(trial.id, "COMPLETED", "GOOD", admin.id)
    await updateTrialStatus(trial.id, "COMPLETED", "GOOD", admin.id)

    const tasks = await prisma.task.findMany({ where: { leadId: lead.id, type: "FOLLOW_UP" } })
    expect(tasks.length).toBe(1)
    const activities = await prisma.activityLog.findMany({ where: { leadId: lead.id, type: "TRIAL_COMPLETED" } })
    expect(activities.length).toBe(1)
  })

  it("second call returns the trial unchanged", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ assignedToId: admin.id, status: "TRIAL_SCHEDULED" })
    const trial = await createTrial(lead.id)

    await updateTrialStatus(trial.id, "NO_SHOW", undefined, admin.id)
    const second = await updateTrialStatus(trial.id, "NO_SHOW", undefined, admin.id)

    expect(second!.status).toBe("NO_SHOW")
    const tasks = await prisma.task.findMany({ where: { leadId: lead.id } })
    expect(tasks.length).toBe(1)
  })
})
```
Run it — both FAIL today (2 tasks / 2 activities).

- [ ] **Step 2: Implement**

In `updateTrialStatus`, BEFORE the `prisma.trialLesson.update`, add:
```ts
  const existing = await prisma.trialLesson.findUnique({
    where: { id },
    include: { lead: { select: { id: true, fullName: true, childName: true, assignedToId: true } } }
  })
  if (!existing) return null
  // Same status again = no-op: side effects (tasks, activity, automations) must not repeat
  if (existing.status === status) return existing
```
The rest of the function stays unchanged. Note the function's callers: check the route (`src/routes/trialLesson.ts`) — if it doesn't already handle a `null` return with a 404, add that handling using the standard error shape.

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/trialStatus.test.ts` → 2 passed
Run: `npm test` → all pass (73 expected)

- [ ] **Step 4: Commit**

```bash
git add src/services/trialLesson.service.ts src/routes/trialLesson.ts test/trialStatus.test.ts
git commit -m "fix(trial): status updates are idempotent, no duplicated side effects" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Trial creation validation (past date, terminal lead)

**Files:**
- Modify: `chore-app/backend/src/services/trialLesson.service.ts` (`createTrialLesson`)
- Modify: `chore-app/backend/src/routes/trialLesson.ts` (error mapping)
- Modify: `chore-app/backend/test/trialStatus.test.ts` (append a describe block)

Today a trial can be scheduled in the past (the "join now" automation fires immediately) or for a CLOSED/CONVERTED lead (`setLeadStatus` silently skips, but the trial + confirmations are still created).

- [ ] **Step 1: Write the failing tests**

Append to `test/trialStatus.test.ts` (add `createTrialLesson` to the service import):
```ts
describe("createTrialLesson validation", () => {
  it("rejects a trial scheduled in the past", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const result = await createTrialLesson(
      { leadId: lead.id, scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      admin.id
    )

    expect(result).toEqual({ error: "TRIAL_IN_PAST" })
    expect(await prisma.trialLesson.count()).toBe(0)
    expect(await prisma.scheduledMessage.count()).toBe(0)
  })

  it("rejects a trial for a CLOSED or CONVERTED lead", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "CLOSED" })

    const result = await createTrialLesson(
      { leadId: lead.id, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      admin.id
    )

    expect(result).toEqual({ error: "LEAD_NOT_ACTIVE" })
    expect(await prisma.trialLesson.count()).toBe(0)
  })

  it("rejects a trial for a missing lead", async () => {
    const admin = await createAdmin()
    const result = await createTrialLesson(
      { leadId: 999999, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      admin.id
    )
    expect(result).toEqual({ error: "LEAD_NOT_FOUND" })
  })
})
```
Run — all three FAIL today (trial gets created / crashes on missing lead relation).

- [ ] **Step 2: Implement**

At the START of `createTrialLesson`, before the `prisma.trialLesson.create`:
```ts
  const scheduledAt = new Date(data.scheduledAt)
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return { error: "TRIAL_IN_PAST" as const }
  }

  const lead = await prisma.lead.findUnique({ where: { id: data.leadId } })
  if (!lead) return { error: "LEAD_NOT_FOUND" as const }
  if (lead.status === "CLOSED" || lead.status === "CONVERTED") {
    return { error: "LEAD_NOT_ACTIVE" as const }
  }
```
Use the parsed `scheduledAt` variable in the `create` call (replace `new Date(data.scheduledAt)`).

The function's return type now includes error objects — update the route (`src/routes/trialLesson.ts` POST handler) to map them before the 201:
```ts
  if (result && "error" in result) {
    const status = result.error === "LEAD_NOT_FOUND" ? 404 : result.error === "TRIAL_IN_PAST" ? 400 : 409
    res.status(status).json({
      error: { code: result.error, message: `Trial creation rejected: ${result.error}` },
      requestId: req.requestId
    })
    return
  }
```
(Adapt variable names to the actual handler — read it first. If TypeScript now complains at other call sites of `createTrialLesson`, fix those call sites to handle the error union; report them in your summary.)

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/trialStatus.test.ts` → 5 passed
Run: `npm test` → all pass (76 expected). Existing tests that create trials via the service with future dates should be unaffected; if any used past dates, update those fixtures to future dates and note it.

- [ ] **Step 4: Commit**

```bash
git add src/services/trialLesson.service.ts src/routes/trialLesson.ts test/trialStatus.test.ts
git commit -m "fix(trial): reject past-dated trials and trials for closed/converted leads" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: convertLead — transaction + unique Student.leadId

**Files:**
- Modify: `chore-app/backend/prisma/schema.prisma` (Student.leadId → `@unique`) + migration
- Modify: `chore-app/backend/src/services/lead.service.ts` (`convertLead`)
- Modify: `chore-app/backend/src/routes/lead.ts` (PUT `/:id` — P2002 defense)
- Create: `chore-app/backend/test/convertLead.test.ts`

- [ ] **Step 1: Schema + migration**

In `schema.prisma`, Student model: change `leadId         Int` to `leadId         Int      @unique` (keep alignment).
Run: `npx prisma migrate dev --name student-leadid-unique`
If the migration fails because dev.db already has duplicate students per lead — STOP, report BLOCKED with the duplicate rows; do not delete data on your own.
(The test DB is rebuilt by `prisma db push` in global-setup, so tests pick the constraint up automatically.)

- [ ] **Step 2: Write the failing test**

Create `test/convertLead.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import { convertLead } from "../src/services/lead.service"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("convertLead atomicity", () => {
  it("two concurrent conversions produce exactly one student", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const [a, b] = await Promise.all([
      convertLead(lead.id, { childName: "ילד", learningFormat: "ONLINE" }, admin.id),
      convertLead(lead.id, { childName: "ילד", learningFormat: "ONLINE" }, admin.id)
    ])

    const students = await prisma.student.count({ where: { leadId: lead.id } })
    expect(students).toBe(1)
    const results = [a, b]
    expect(results.filter((r) => r && "student" in r).length).toBe(1)
    expect(results.filter((r) => r && "error" in r && r.error === "ALREADY_CONVERTED").length).toBe(1)
    const after = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(after!.status).toBe("CONVERTED")
  })

  it("sequential double-convert still returns ALREADY_CONVERTED", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const first = await convertLead(lead.id, { childName: "ילד", learningFormat: "ONLINE" }, admin.id)
    const second = await convertLead(lead.id, { childName: "ילד", learningFormat: "ONLINE" }, admin.id)

    expect(first && "student" in first).toBe(true)
    expect(second).toEqual({ error: "ALREADY_CONVERTED" })
  })
})
```
Run — the concurrent test FAILS today (two students, or one raw P2002 crash once the constraint exists — either way not the clean result).

- [ ] **Step 3: Implement**

In `convertLead`, replace the student-create → group-refresh → lead-update sequence with a transaction + P2002 mapping (imports: add `Prisma` — `import { Prisma } from "@prisma/client"`):
```ts
  let student
  try {
    student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          leadId: id,
          childName: studentData.childName,
          childBirthYear: studentData.childBirthYear,
          learningFormat: studentData.learningFormat,
          branch: studentData.branch,
          groupId: targetGroupId
        }
      })
      await tx.lead.update({
        where: { id },
        data: { status: "CONVERTED" }
      })
      return created
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "ALREADY_CONVERTED" as const }
    }
    throw err
  }

  if (targetGroupId) {
    await refreshGroupFullStatus(targetGroupId)
  }
```
Everything after (logActivity, enqueue STUDENT_WELCOME, `return { student }`) stays as-is. The early `if (lead.status === "CONVERTED") return { error: "ALREADY_CONVERTED" }` check stays too (fast path).

In `src/routes/lead.ts` PUT `/:id` handler, wrap the `prisma.lead.update` call in the same defense (race between the dedup pre-check and the update):
```ts
  let updated
  try {
    updated = await prisma.lead.update({
      // ... existing where/data unchanged ...
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({
        error: { code: "DUPLICATE_PHONE", message: "Another lead already has this phone number" },
        requestId: req.requestId
      })
      return
    }
    throw err
  }
```
(Add the `Prisma` import to lead.ts. No dedicated test for this race — the friendly-path 409 is already covered by `lead.api.test.ts`; this is defense-in-depth.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/convertLead.test.ts` → 2 passed
Run: `npm test` → all pass (78 expected). `crmUsability.test.ts` conversion tests must stay green (FULL-group conversion, inline group creation) — if they break, the transaction changed behavior; fix the implementation, not the tests.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/services/lead.service.ts src/routes/lead.ts test/convertLead.test.ts
git commit -m "fix(lead): atomic conversion with unique student-per-lead constraint" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Group membership route honors the group id

**Files:**
- Modify: `chore-app/backend/src/services/group.service.ts` (`removeStudentFromGroup`)
- Modify: `chore-app/backend/src/routes/group.ts` (DELETE `/:id/student/:studentId`)
- Create: `chore-app/backend/test/groupIntegrity.test.ts`

Today `DELETE /api/group/:id/student/:studentId` ignores `:id` — a request under the WRONG group still removes the student from their real group.

- [ ] **Step 1: Write the failing test**

Create `test/groupIntegrity.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

async function createStudentInGroup(groupName: string, maxCapacity = 8) {
  const lead = await createLead()
  const group = await prisma.group.create({
    data: { name: groupName, type: "Scratch", learningFormat: "ONLINE", maxCapacity }
  })
  const student = await prisma.student.create({
    data: { leadId: lead.id, childName: "ילד", learningFormat: "ONLINE", groupId: group.id }
  })
  return { group, student }
}

describe("remove student honors the group id", () => {
  it("rejects removal under the wrong group and keeps membership", async () => {
    const admin = await createAdmin()
    const { group, student } = await createStudentInGroup("קבוצה א")
    const otherGroup = await prisma.group.create({
      data: { name: "קבוצה ב", type: "Python", learningFormat: "ONLINE" }
    })

    const res = await request(app)
      .delete(`/api/group/${otherGroup.id}/student/${student.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("NOT_IN_GROUP")
    const after = await prisma.student.findUnique({ where: { id: student.id } })
    expect(after!.groupId).toBe(group.id)
  })

  it("removes under the correct group", async () => {
    const admin = await createAdmin()
    const { group, student } = await createStudentInGroup("קבוצה א")

    const res = await request(app)
      .delete(`/api/group/${group.id}/student/${student.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(200)
    const after = await prisma.student.findUnique({ where: { id: student.id } })
    expect(after!.groupId).toBeNull()
  })
})
```
Run — first test FAILS (200, student removed from the real group).

- [ ] **Step 2: Implement**

Service — change the signature to require the group and verify membership:
```ts
export async function removeStudentFromGroup(groupId: number, studentId: number) {
  const current = await prisma.student.findUnique({ where: { id: studentId } })
  if (!current) return { error: "STUDENT_NOT_FOUND" as const }
  if (current.groupId !== groupId) return { error: "NOT_IN_GROUP" as const }

  const student = await prisma.student.update({
    where: { id: studentId },
    data: { groupId: null }
  })

  await refreshGroupFullStatus(groupId)
  return { student }
}
```

Route — `DELETE /:id/student/:studentId` in `group.ts`:
```ts
router.delete("/:id/student/:studentId", async (req: Request, res: Response) => {
  const groupId = Number(req.params.id)
  const studentId = Number(req.params.studentId)
  const result = await groupService.removeStudentFromGroup(groupId, studentId)
  if ("error" in result) {
    const status = result.error === "STUDENT_NOT_FOUND" ? 404 : 409
    res.status(status).json({
      error: { code: result.error, message: `Removal rejected: ${result.error}` },
      requestId: req.requestId
    })
    return
  }
  res.json(result.student)
})
```
Check for other callers of `removeStudentFromGroup` (grep) and update them to the new signature; report any you find.

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/groupIntegrity.test.ts` → 2 passed
Run: `npm test` → all pass (80 expected)

- [ ] **Step 4: Commit**

```bash
git add src/services/group.service.ts src/routes/group.ts test/groupIntegrity.test.ts
git commit -m "fix(group): student removal verifies membership in the addressed group" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Group status stays consistent on transfers and direct student edits

**Files:**
- Modify: `chore-app/backend/src/services/group.service.ts` (`addStudentToGroup`)
- Modify: `chore-app/backend/src/services/student.service.ts` (`updateStudent`)
- Modify: `chore-app/backend/src/routes/student.ts` (error mapping — read it first)
- Modify: `chore-app/backend/test/groupIntegrity.test.ts` (append)

Two gaps: (a) transferring a student via `addStudentToGroup` refreshes only the NEW group — a full old group stays `FULL` forever; (b) `updateStudent` can change `groupId` directly, bypassing the capacity check and both refreshes.

- [ ] **Step 1: Write the failing tests**

Append to `test/groupIntegrity.test.ts` (import `addStudentToGroup` from the service; import `updateStudent` from student.service):
```ts
describe("group status consistency", () => {
  it("transfer refreshes the old group back to ACTIVE", async () => {
    await createAdmin()
    const { group: full, student } = await createStudentInGroup("מלאה", 1)
    await prisma.group.update({ where: { id: full.id }, data: { status: "FULL" } })
    const target = await prisma.group.create({
      data: { name: "יעד", type: "Python", learningFormat: "ONLINE", maxCapacity: 8 }
    })

    const result = await addStudentToGroup(target.id, student.id)

    expect("student" in result).toBe(true)
    const oldAfter = await prisma.group.findUnique({ where: { id: full.id } })
    expect(oldAfter!.status).toBe("ACTIVE")
  })

  it("direct student edit into a full group is rejected", async () => {
    await createAdmin()
    const { group: full } = await createStudentInGroup("מלאה", 1)
    const { student: other } = await createStudentInGroup("אחרת")

    const result = await updateStudent(other.id, { groupId: full.id })

    expect(result).toEqual({ error: "GROUP_FULL" })
    const after = await prisma.student.findUnique({ where: { id: other.id } })
    expect(after!.groupId).not.toBe(full.id)
  })

  it("direct student edit refreshes both groups' status", async () => {
    await createAdmin()
    const { group: old, student } = await createStudentInGroup("ישנה", 1)
    await prisma.group.update({ where: { id: old.id }, data: { status: "FULL" } })
    const target = await prisma.group.create({
      data: { name: "חדשה", type: "Python", learningFormat: "ONLINE", maxCapacity: 1 }
    })

    const result = await updateStudent(student.id, { groupId: target.id })

    expect(result && "error" in result).toBe(false)
    expect((await prisma.group.findUnique({ where: { id: old.id } }))!.status).toBe("ACTIVE")
    expect((await prisma.group.findUnique({ where: { id: target.id } }))!.status).toBe("FULL")
  })
})
```
Run — all three FAIL today.

- [ ] **Step 2: Implement**

`addStudentToGroup` — capture and refresh the previous group:
```ts
export async function addStudentToGroup(groupId: number, studentId: number, allowOverfill = false) {
  const capacity = await checkGroupCapacity(groupId)
  if (!capacity.ok) {
    if (capacity.reason === "GROUP_NOT_FOUND") return { error: "GROUP_NOT_FOUND" as const }
    if (!allowOverfill) return { error: capacity.reason }
  }

  const previous = await prisma.student.findUnique({ where: { id: studentId } })
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { groupId }
  })

  await refreshGroupFullStatus(groupId)
  if (previous?.groupId && previous.groupId !== groupId) {
    await refreshGroupFullStatus(previous.groupId)
  }
  return { student }
}
```

`updateStudent` — gate + refresh on group change (import `checkGroupCapacity`, `refreshGroupFullStatus` from `./group.service`):
```ts
export async function updateStudent(id: number, data: UpdateStudentData) {
  const current = await prisma.student.findUnique({ where: { id } })
  if (!current) return null

  const groupChanging = data.groupId !== undefined && data.groupId !== current.groupId
  if (groupChanging && data.groupId != null) {
    const capacity = await checkGroupCapacity(data.groupId)
    if (!capacity.ok) return { error: capacity.reason }
  }

  const student = await prisma.student.update({
    where: { id },
    data,
    include: {
      lead: { select: { fullName: true } },
      group: { select: { name: true } }
    }
  })

  if (groupChanging) {
    if (data.groupId != null) await refreshGroupFullStatus(data.groupId)
    if (current.groupId) await refreshGroupFullStatus(current.groupId)
  }

  return student
}
```
Watch for an import cycle: `group.service.ts` must NOT import from `student.service.ts` (it doesn't today) — importing group.service from student.service is one-directional and safe.

Route: read `src/routes/student.ts` PUT handler; it must map the new returns — `null` → 404 NOT_FOUND, `{ error: "GROUP_FULL" | "GROUP_NOT_FOUND" }` → 409/404 with the standard shape. Adapt to its current structure and report what you changed. Also grep for other `updateStudent` callers and align them.

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/groupIntegrity.test.ts` → 5 passed
Run: `npm test` → all pass (83 expected)

- [ ] **Step 4: Commit**

```bash
git add src/services/group.service.ts src/services/student.service.ts src/routes/student.ts test/groupIntegrity.test.ts
git commit -m "fix(group): capacity check and status refresh on transfers and direct edits" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Full verification + docs + PR

- [ ] **Step 1: Full suite + builds**

From `chore-app/backend/`: `npm test` (expect ~83 passed) and `npm run build` (clean).
From `chore-app/frontend/`: `npm run build` (clean — backend-only changes, but verify).

- [ ] **Step 2: Docs**

In root `CLAUDE.md` Key Notes:
- Update the group-capacity bullet to reflect reality: capacity enforced on assignment AND direct student edits; conversion deliberately allows overfill; transfers/removals refresh the old group's status.
- In the WhatsApp automation bullet, add: a failed row is isolated (FAILED + admin notification) and orphaned SENDING claims are reclaimed after 15 minutes.

- [ ] **Step 3: Commit docs, push, PR**

```bash
git add CLAUDE.md
git commit -m "docs: reflect service-hardening behavior in CLAUDE.md" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -u origin feat/service-hardening
gh pr create --title "fix: service hardening - automation resilience, transactions, integrity" --body "Closes package 2 of the 2026-07-15 review (plan 015): dispatch row isolation + stale-claim reclaim, TEMPLATE_NOT_FOUND, idempotent trial status, trial creation validation, atomic lead conversion (unique Student.leadId), group membership + capacity integrity.

🤖 Generated with [Claude Code](https://claude.com/claude-code)" --base master
```

---

## Verification checklist (after all tasks)

- [ ] `npm test` green (~83 tests) from `chore-app/backend/`
- [ ] Migration `student-leadid-unique` present in `prisma/migrations/`
- [ ] Both builds clean
- [ ] `git log --oneline master..` shows ~8 focused commits
