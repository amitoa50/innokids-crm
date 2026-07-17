import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../src/app"
import { getJwtSecret } from "../src/lib/jwtSecret"
import { resetDb, createAdmin, createStaff, prisma } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

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

describe("per-request user re-validation", () => {
  it("rejects a valid token once the user is deactivated", async () => {
    const admin = await createAdmin()
    const token = tokenFor(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { status: "INACTIVE" } })

    const res = await request(app)
      .get("/api/notification")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it("applies a role downgrade immediately, before token expiry", async () => {
    const admin = await createAdmin()
    const token = tokenFor(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { role: "STAFF" } })

    const res = await request(app)
      .post("/api/user")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@test.local", password: "pw123456", name: "חדש" })
    expect(res.status).toBe(403)
  })
})

describe("login route", () => {
  it("returns 401 UNAUTHORIZED for wrong credentials", async () => {
    await createAdmin()
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.local", password: "wrong-password" })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe("UNAUTHORIZED")
  })
})

describe("team list access", () => {
  it("lets STAFF list users for assignment dropdowns", async () => {
    await createAdmin()
    const staff = await createStaff()

    const res = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
    expect(res.body[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) })
    expect(res.body[0]).not.toHaveProperty("password")
  })

  it("still blocks STAFF from creating users", async () => {
    const staff = await createStaff()

    const res = await request(app)
      .post("/api/user")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ email: "x@test.local", password: "pw123456", name: "לא מורשה" })
    expect(res.status).toBe(403)
  })
})

describe("hard-deleted user", () => {
  it("rejects a valid token when the user row no longer exists", async () => {
    const admin = await createAdmin()
    const token = tokenFor(admin)
    await prisma.user.delete({ where: { id: admin.id } })

    const res = await request(app)
      .get("/api/notification")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(401)
  })
})
