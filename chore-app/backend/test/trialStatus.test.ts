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
