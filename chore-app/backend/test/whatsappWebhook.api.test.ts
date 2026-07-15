import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { resetDb } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("mock webhook authentication", () => {
  it("rejects an unsigned webhook post", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(401)
  })

  it("rejects a wrong secret", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", "wrong")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(401)
  })

  it("accepts a post carrying the shared secret", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .set("x-hub-signature-256", "test-app-secret")
      .send({ inbound: [], statuses: [] })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })
})
