import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { updateTemplateBody, updateTemplateStatus } from "../src/services/template.service"
import { prisma, resetDb } from "./helpers/db"

const originalProvider = process.env.WHATSAPP_PROVIDER

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  process.env.WHATSAPP_PROVIDER = originalProvider
})

async function template(name: string) {
  return prisma.messageTemplate.findUniqueOrThrow({ where: { name } })
}

describe("updateTemplateBody approval drift guard", () => {
  it("revokes approval when editing an APPROVED template under the cloud provider", async () => {
    const tpl = await template("lead_welcome")
    expect(tpl.status).toBe("APPROVED")
    process.env.WHATSAPP_PROVIDER = "cloud"

    const result = await updateTemplateBody(tpl.id, "שלום {{1}}, נוסח חדש")

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.approvalRevoked).toBe(true)
    expect(result.template.status).toBe("DRAFT")
    expect(result.template.body).toBe("שלום {{1}}, נוסח חדש")
    expect((await template("lead_welcome")).status).toBe("DRAFT")
  })

  it("keeps an APPROVED template approved under the mock provider", async () => {
    const tpl = await template("lead_welcome")

    const result = await updateTemplateBody(tpl.id, "שלום {{1}}, נוסח חדש")

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.approvalRevoked).toBe(false)
    expect(result.template.status).toBe("APPROVED")
  })

  it("does not flag revocation when the template was not approved", async () => {
    const tpl = await template("lead_welcome")
    await prisma.messageTemplate.update({ where: { id: tpl.id }, data: { status: "DRAFT" } })
    process.env.WHATSAPP_PROVIDER = "cloud"

    const result = await updateTemplateBody(tpl.id, "שלום {{1}}, נוסח חדש")

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.approvalRevoked).toBe(false)
    expect(result.template.status).toBe("DRAFT")
  })

  it("resets a PENDING template to DRAFT on body edit under the cloud provider", async () => {
    const tpl = await template("lead_welcome")
    await prisma.messageTemplate.update({ where: { id: tpl.id }, data: { status: "PENDING" } })
    process.env.WHATSAPP_PROVIDER = "cloud"

    const result = await updateTemplateBody(tpl.id, "שלום {{1}}, נוסח שהשתנה אחרי הגשה")

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.approvalRevoked).toBe(true)
    expect(result.template.status).toBe("DRAFT")
  })
})

describe("updateTemplateStatus (manual Meta approval sync)", () => {
  it("records an approval outcome", async () => {
    const tpl = await template("lead_welcome")
    await prisma.messageTemplate.update({ where: { id: tpl.id }, data: { status: "PENDING" } })

    const result = await updateTemplateStatus(tpl.id, { status: "APPROVED" })

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.template.status).toBe("APPROVED")
  })

  it("syncs the Meta-assigned category when provided", async () => {
    const tpl = await template("lead_welcome")
    expect(tpl.category).toBe("UTILITY")

    const result = await updateTemplateStatus(tpl.id, { status: "APPROVED", category: "MARKETING" })

    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.template.category).toBe("MARKETING")
    expect(result.template.status).toBe("APPROVED")
  })

  it("rejects an unknown status value", async () => {
    const tpl = await template("lead_welcome")

    const result = await updateTemplateStatus(tpl.id, { status: "SHIPPED" })

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("BAD_REQUEST")
  })

  it("rejects an unknown category value", async () => {
    const tpl = await template("lead_welcome")

    const result = await updateTemplateStatus(tpl.id, { status: "APPROVED", category: "SPAM" })

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("BAD_REQUEST")
  })

  it("returns NOT_FOUND for an unknown template id", async () => {
    const result = await updateTemplateStatus(999999, { status: "APPROVED" })

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("NOT_FOUND")
  })
})

describe("updateTemplateBody validation", () => {
  it("rejects a placeholder beyond the variable count", async () => {
    const tpl = await template("lead_welcome")

    const result = await updateTemplateBody(tpl.id, "שלום {{9}}")

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("BAD_REQUEST")
    expect((await template("lead_welcome")).body).toBe(tpl.body)
  })

  it("rejects an empty body", async () => {
    const tpl = await template("lead_welcome")

    const result = await updateTemplateBody(tpl.id, "   ")

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("BAD_REQUEST")
  })

  it("returns NOT_FOUND for an unknown template id", async () => {
    const result = await updateTemplateBody(999999, "נוסח")

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.error.code).toBe("NOT_FOUND")
  })
})
