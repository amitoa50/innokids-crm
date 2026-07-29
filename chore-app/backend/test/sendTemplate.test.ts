import { describe, it, expect, beforeEach } from "vitest"
import { sendWhatsApp } from "../src/services/whatsapp/send.service"
import { prisma, resetDb, createLead } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

describe("sendWhatsApp template validation", () => {
  it("rejects a template that does not exist", async () => {
    const lead = await createLead()
    const result = await sendWhatsApp(lead.id, { templateName: "no_such_template", variables: [] })
    expect(result).toEqual({ error: "TEMPLATE_NOT_FOUND" })
    const messages = await prisma.message.findMany()
    expect(messages.length).toBe(0)
  })

  it("still rejects an unapproved template", async () => {
    const lead = await createLead()
    const tpl = await prisma.messageTemplate.findFirst()
    await prisma.messageTemplate.update({ where: { id: tpl!.id }, data: { status: "DRAFT" } })
    const result = await sendWhatsApp(lead.id, { templateName: tpl!.name, variables: [] })
    expect(result).toEqual({ error: "TEMPLATE_NOT_APPROVED" })
  })
})
