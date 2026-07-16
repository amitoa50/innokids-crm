import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("PUT /api/lead/:id phone handling", () => {
  it("recomputes phoneNormalized when phone changes", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const res = await request(app)
      .put(`/api/lead/${lead.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ phone: "052-333-4444" })

    expect(res.status).toBe(200)
    const updated = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(updated!.phone).toBe("052-333-4444")
    expect(updated!.phoneNormalized).toBe("+972523334444")
  })

  it("returns 409 DUPLICATE_PHONE when the new phone belongs to another lead", async () => {
    const admin = await createAdmin()
    const leadA = await createLead()
    const leadB = await createLead()

    const res = await request(app)
      .put(`/api/lead/${leadA.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ phone: leadB.phone })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("DUPLICATE_PHONE")
  })
})
