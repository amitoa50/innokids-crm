import { describe, it, expect, beforeEach } from "vitest"
import { updateTrialStatus, createTrialLesson, updateTrialLesson } from "../src/services/trialLesson.service"
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

  it("same-status call with a new outcome persists the correction without side effects", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ assignedToId: admin.id, status: "TRIAL_SCHEDULED" })
    const trial = await createTrial(lead.id)

    await updateTrialStatus(trial.id, "COMPLETED", "GOOD", admin.id)
    const corrected = await updateTrialStatus(trial.id, "COMPLETED", "BAD", admin.id)

    expect(corrected!.outcome).toBe("BAD")
    const tasks = await prisma.task.findMany({ where: { leadId: lead.id, type: "FOLLOW_UP" } })
    expect(tasks.length).toBe(1)
    const activities = await prisma.activityLog.findMany({ where: { leadId: lead.id, type: "TRIAL_COMPLETED" } })
    expect(activities.length).toBe(1)
  })
})

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

describe("updateTrialLesson validation", () => {
  it("rejects a reschedule into the past", async () => {
    const admin = await createAdmin()
    const lead = await createLead()
    const trial = await createTrial(lead.id)

    const result = await updateTrialLesson(trial.id, {
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    })

    expect(result).toEqual({ error: "TRIAL_IN_PAST" })
    const after = await prisma.trialLesson.findUnique({ where: { id: trial.id } })
    expect(after!.scheduledAt.getTime()).toBe(trial.scheduledAt.getTime())
  })

  it("returns null for a missing trial id", async () => {
    await createAdmin()
    const result = await updateTrialLesson(999999, { notes: "x" })
    expect(result).toBeNull()
  })
})
