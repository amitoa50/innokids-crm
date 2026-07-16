import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { resetDb, createAdmin } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("global error handler", () => {
  it("returns the JSON error shape for unhandled route errors", async () => {
    const admin = await createAdmin()

    // "abc" -> Number("abc") = NaN -> Prisma throws on findUnique({ where: { id: NaN } })
    const res = await request(app)
      .get("/api/lead/abc")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe("INTERNAL")
    expect(res.body.requestId).toBeTruthy()
  })
})
