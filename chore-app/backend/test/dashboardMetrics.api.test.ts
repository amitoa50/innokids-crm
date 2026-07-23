import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { resetDb, createAdmin, createLead, createTrial, prisma } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("GET /api/report/dashboard", () => {
  it("counts a lead by its LEAD_CONVERTED activity, not by unrelated edits to an old conversion", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "CONVERTED" })
    await prisma.activityLog.create({
      data: {
        type: "LEAD_CONVERTED",
        description: "ליד הומר לתלמיד",
        leadId: lead.id,
        createdAt: new Date(new Date().getFullYear() - 1, 0, 1)
      }
    })
    await prisma.lead.update({ where: { id: lead.id }, data: { notes: "עדכון לא קשור" } })

    const res = await request(app)
      .get("/api/report/dashboard")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.conversions).toBe(0)
  })

  it("counts a lead converted this month", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "CONVERTED" })
    await prisma.activityLog.create({
      data: { type: "LEAD_CONVERTED", description: "ליד הומר לתלמיד", leadId: lead.id, createdAt: new Date() }
    })

    const res = await request(app)
      .get("/api/report/dashboard")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
    expect(res.body.conversions).toBe(1)
  })

  it("does not count a trial scheduled for next month as this month's stat", async () => {
    const admin = await createAdmin()
    const lead = await createLead()
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15)
    await createTrial(lead.id, { scheduledAt: nextMonth, status: "SCHEDULED" })

    const res = await request(app)
      .get("/api/report/dashboard")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
    expect(res.body.trialsScheduled).toBe(0)
  })

  it("counts a trial scheduled for this month", async () => {
    const admin = await createAdmin()
    const lead = await createLead()
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 20)
    await createTrial(lead.id, { scheduledAt: thisMonth, status: "SCHEDULED" })

    const res = await request(app)
      .get("/api/report/dashboard")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
    expect(res.body.trialsScheduled).toBe(1)
  })
})
