import { describe, it, expect } from "vitest"
import request from "supertest"
import app from "../src/app"

describe("app", () => {
  it("serves /api/health with a requestId", async () => {
    const res = await request(app).get("/api/health")
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.requestId).toBeTruthy()
  })
})
