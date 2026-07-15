import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../src/app"
import { getJwtSecret } from "../src/lib/jwtSecret"
import { resetDb, createAdmin } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("JWT secret handling", () => {
  it("getJwtSecret throws when JWT_SECRET is missing", () => {
    const saved = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    try {
      expect(() => getJwtSecret()).toThrow()
    } finally {
      process.env.JWT_SECRET = saved
    }
  })

  it("rejects a token forged with the old fallback secret", async () => {
    const admin = await createAdmin()
    const forged = jwt.sign(
      { userId: admin.id, email: admin.email, role: "ADMIN" },
      "secret",
      { expiresIn: "1h" }
    )
    const res = await request(app)
      .get("/api/notification")
      .set("Authorization", `Bearer ${forged}`)
    expect(res.status).toBe(401)
  })
})

describe("registration is closed", () => {
  it("returns 404 for POST /api/auth/register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "intruder@evil.com", password: "hack", name: "פולש" })
    expect(res.status).toBe(404)
  })
})
