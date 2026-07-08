import { describe, it, expect, beforeEach, afterEach } from "vitest"
import bcrypt from "bcryptjs"
import { seedAdmin } from "../src/lib/adminSeed"
import { prisma, resetDb } from "./helpers/db"

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
}

beforeEach(async () => {
  await resetDb()
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
})

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe("seedAdmin", () => {
  it("seeds from ADMIN_EMAIL/ADMIN_PASSWORD when both are set", async () => {
    process.env.ADMIN_EMAIL = "owner@innokids.co.il"
    process.env.ADMIN_PASSWORD = "real-secret-1"

    await seedAdmin()

    const users = await prisma.user.findMany()
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe("owner@innokids.co.il")
    expect(users[0].role).toBe("ADMIN")
    expect(await bcrypt.compare("real-secret-1", users[0].password)).toBe(true)
  })

  it("refuses to seed the dev default in production", async () => {
    process.env.NODE_ENV = "production"

    await seedAdmin()

    expect(await prisma.user.count()).toBe(0)
  })

  it("seeds the dev default outside production when no env credentials are set", async () => {
    process.env.NODE_ENV = "development"

    await seedAdmin()

    const users = await prisma.user.findMany()
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe("admin@office.local")
    expect(await bcrypt.compare("admin123", users[0].password)).toBe(true)
  })

  it("does nothing when users already exist", async () => {
    await prisma.user.create({
      data: { email: "existing@innokids.co.il", name: "Existing", password: "hashed", role: "ADMIN" }
    })
    process.env.ADMIN_EMAIL = "owner@innokids.co.il"
    process.env.ADMIN_PASSWORD = "real-secret-1"

    await seedAdmin()

    const users = await prisma.user.findMany()
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe("existing@innokids.co.il")
  })
})
