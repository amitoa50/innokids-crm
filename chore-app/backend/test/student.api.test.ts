import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { convertLead } from "../src/services/lead.service"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("POST /api/student unique leadId (T5)", () => {
  it("returns 409 LEAD_ALREADY_CONVERTED when a student already exists for the lead", async () => {
    const admin = await createAdmin()
    const lead = await createLead()
    const converted = await convertLead(lead.id, { childName: "ילד", learningFormat: "ONLINE" }, admin.id)
    expect(converted && "error" in converted).toBe(false)

    const res = await request(app)
      .post("/api/student")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ leadId: lead.id, childName: "ילד שני", learningFormat: "ONLINE" })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("LEAD_ALREADY_CONVERTED")
    expect(res.body.requestId).toBeTruthy()
    expect(await prisma.student.count({ where: { leadId: lead.id } })).toBe(1)
  })

  it("still creates a student for a lead without one", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const res = await request(app)
      .post("/api/student")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ leadId: lead.id, childName: "ילד", learningFormat: "ONLINE" })

    expect(res.status).toBe(201)
    expect(res.body.leadId).toBe(lead.id)
  })
})
