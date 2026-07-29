import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { resetDb, createAdmin } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("security headers", () => {
  it("sets helmet's baseline security headers", async () => {
    const res = await request(app).get("/api/health")
    expect(res.headers["x-content-type-options"]).toBe("nosniff")
    expect(res.headers["x-dns-prefetch-control"]).toBe("off")
  })
})

describe("login rate limiting", () => {
  it("allows up to AUTH_RATE_LIMIT_MAX attempts then returns 429", async () => {
    await createAdmin()
    const max = Number(process.env.AUTH_RATE_LIMIT_MAX)

    for (let i = 0; i < max; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.local", password: "wrong-password" })
      expect(res.status).toBe(401)
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.local", password: "wrong-password" })
    expect(blocked.status).toBe(429)
  })
})
