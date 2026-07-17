import { describe, it, expect, beforeEach } from "vitest"
import { enqueue, cancelForEntity, dispatchDue } from "../src/services/automation.service"
import {
  prisma,
  resetDb,
  createAdmin,
  createLead,
  createTrial,
  createScheduledRow,
  logWhatsAppMessage
} from "./helpers/db"

beforeEach(async () => {
  await resetDb()
})

async function outboundMessages(leadId: number) {
  return prisma.message.findMany({
    where: { direction: "OUTBOUND", channel: "WHATSAPP", conversation: { leadId } }
  })
}

describe("dispatch claiming", () => {
  it("does not send a row already claimed as SENDING", async () => {
    const lead = await createLead()
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge",
      status: "SENDING"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("SENDING")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
  })

  it("sends a due row exactly once across two dispatch runs", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })

    await dispatchDue()
    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("SENT")
    expect(after.messageId).not.toBeNull()
    expect(await outboundMessages(lead.id)).toHaveLength(1)
  })

  it("never resurrects a terminal row on re-enqueue", async () => {
    const lead = await createLead()
    const sentAt = new Date(Date.now() - 60 * 1000)
    await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "LEAD_WELCOME",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "lead_welcome",
      status: "SENT",
      dueAt: sentAt
    })

    await enqueue("LEAD_WELCOME", {
      leadId: lead.id,
      entityType: "LEAD",
      entityId: lead.id,
      baseTime: new Date(),
      parentName: lead.fullName
    })

    const rows = await prisma.scheduledMessage.findMany({ where: { leadId: lead.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("SENT")
    expect(rows[0].dueAt.getTime()).toBe(sentAt.getTime())
  })
})

describe("dispatch-time guards", () => {
  it("cancels a trial reminder when the trial is no longer SCHEDULED", async () => {
    const lead = await createLead()
    const trial = await createTrial(lead.id, { status: "COMPLETED" })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "TRIAL_REMINDER",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "trial_reminder",
      variables: ["הורה בדיקה", "1.1.2027", "17:00"]
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("TRIAL_NOT_SCHEDULED")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
  })

  it("cancels the post-trial follow-up when the lead converted", async () => {
    const lead = await createLead({ status: "CONVERTED" })
    const trial = await createTrial(lead.id, { status: "COMPLETED" })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "POST_TRIAL_FOLLOW_UP",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "post_trial_followup",
      variables: ["הורה בדיקה", "ילד בדיקה"]
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("LEAD_CONVERTED")
  })

  it("cancels the lead welcome when a prior outbound WhatsApp exists", async () => {
    const lead = await createLead()
    await logWhatsAppMessage(lead.id, "OUTBOUND")
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "LEAD_WELCOME",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "lead_welcome"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("ALREADY_CONTACTED")
  })
})

describe("reply-aware stops", () => {
  it("sends the welcome follow-up when the parent has not replied", async () => {
    const lead = await createLead({ status: "NEW", marketingConsent: true })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "LEAD_WELCOME_FOLLOWUP",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "lead_welcome_followup"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("SENT")
    expect(await outboundMessages(lead.id)).toHaveLength(1)
  })

  it("cancels the welcome follow-up when an inbound reply postdates the sequence anchor", async () => {
    const lead = await createLead({ status: "NEW" })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "LEAD_WELCOME_FOLLOWUP",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "lead_welcome_followup"
    })
    await logWhatsAppMessage(lead.id, "INBOUND")

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("REPLIED")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
  })

  it("cancels the welcome follow-up when the lead progressed past CONTACTED", async () => {
    const lead = await createLead({ status: "TRIAL_SCHEDULED" })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "LEAD_WELCOME_FOLLOWUP",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "lead_welcome_followup"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("LEAD_PROGRESSED")
  })

  it("cancels a later no-response nudge on reply but sends it without one", async () => {
    const replied = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const silent = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const repliedRow = await createScheduledRow({
      leadId: replied.id,
      triggerEvent: "NO_RESPONSE_NUDGE_2",
      entityType: "LEAD",
      entityId: replied.id,
      templateName: "no_response_nudge_2"
    })
    const silentRow = await createScheduledRow({
      leadId: silent.id,
      triggerEvent: "NO_RESPONSE_NUDGE_2",
      entityType: "LEAD",
      entityId: silent.id,
      templateName: "no_response_nudge_2"
    })
    await logWhatsAppMessage(replied.id, "INBOUND")

    await dispatchDue()

    const afterReplied = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: repliedRow.id } })
    expect(afterReplied.status).toBe("CANCELLED")
    expect(afterReplied.failureReason).toBe("REPLIED")
    const afterSilent = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: silentRow.id } })
    expect(afterSilent.status).toBe("SENT")
  })

  it("cancels a later no-response nudge once the lead leaves NO_RESPONSE", async () => {
    const lead = await createLead({ status: "TRIAL_SCHEDULED" })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE_3",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge_3"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("NOT_NO_RESPONSE")
  })
})

describe("reschedule and cancel", () => {
  it("updates the pending reminder dueAt in place on re-enqueue", async () => {
    const lead = await createLead()
    const trial = await createTrial(lead.id)
    const firstTime = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const secondTime = new Date(Date.now() + 96 * 60 * 60 * 1000)
    const ctx = {
      leadId: lead.id,
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      parentName: lead.fullName,
      scheduledAt: firstTime,
      baseTime: firstTime
    }

    await enqueue("TRIAL_REMINDER", ctx)
    await enqueue("TRIAL_REMINDER", { ...ctx, scheduledAt: secondTime, baseTime: secondTime })

    const rows = await prisma.scheduledMessage.findMany({
      where: { entityType: "TRIAL_LESSON", entityId: trial.id }
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("PENDING")
    expect(rows[0].dueAt.getTime()).toBe(secondTime.getTime() - 1440 * 60 * 1000)
  })

  it("cancels pending rows for an entity and leaves sent rows untouched", async () => {
    const lead = await createLead()
    const trial = await createTrial(lead.id)
    const sent = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "TRIAL_CONFIRMATION",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "trial_confirmation",
      status: "SENT"
    })
    const pending = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "TRIAL_REMINDER",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "trial_reminder",
      dueAt: new Date(Date.now() + 60 * 60 * 1000)
    })

    await cancelForEntity("TRIAL_LESSON", trial.id, "TRIAL_CANCELLED")

    const afterPending = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: pending.id } })
    expect(afterPending.status).toBe("CANCELLED")
    expect(afterPending.failureReason).toBe("TRIAL_CANCELLED")
    const afterSent = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: sent.id } })
    expect(afterSent.status).toBe("SENT")
  })
})

describe("dispatch safety rails", () => {
  it("fails the row and notifies admins when the template is not approved", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "NO_RESPONSE" })
    await prisma.messageTemplate.update({
      where: { name: "no_response_nudge" },
      data: { status: "DRAFT" }
    })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("FAILED")
    expect(after.failureReason).toBe("NO_APPROVED_TEMPLATE")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
    const notifications = await prisma.notification.findMany({ where: { userId: admin.id } })
    expect(notifications).toHaveLength(1)
  })

  it("cancels a MARKETING template send when the lead lacks marketing consent", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: false })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("NO_MARKETING_CONSENT")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
  })

  it("sends a MARKETING template when the lead has marketing consent", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("SENT")
    expect(await outboundMessages(lead.id)).toHaveLength(1)
  })

  it("sends a UTILITY template without marketing consent", async () => {
    const lead = await createLead({ marketingConsent: false })
    const trial = await createTrial(lead.id)
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "TRIAL_CONFIRMATION",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "trial_confirmation",
      variables: ["הורה בדיקה", "1.1.2027", "17:00"]
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("SENT")
    expect(await outboundMessages(lead.id)).toHaveLength(1)
  })

  it("cancels the row when consent was revoked before dispatch", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", whatsappConsent: false })
    const row = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.failureReason).toBe("CONSENT_REVOKED")
    expect(await outboundMessages(lead.id)).toHaveLength(0)
  })
})

describe("dispatch resilience", () => {
  it("a row that throws is FAILED and does not halt the rest of the batch", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const trial = await createTrial(lead.id)
    const bad = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge"
    })
    // corrupt the variables JSON so JSON.parse throws mid-loop
    await prisma.scheduledMessage.update({ where: { id: bad.id }, data: { variables: "{not-json" } })
    const good = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "TRIAL_CONFIRMATION",
      entityType: "TRIAL_LESSON",
      entityId: trial.id,
      templateName: "trial_confirmation",
      variables: ["הורה בדיקה", "1.1.2027", "17:00"]
    })

    await dispatchDue()

    const badAfter = await prisma.scheduledMessage.findUnique({ where: { id: bad.id } })
    const goodAfter = await prisma.scheduledMessage.findUnique({ where: { id: good.id } })
    expect(badAfter!.status).toBe("FAILED")
    expect(badAfter!.failureReason).toContain("DISPATCH_ERROR")
    expect(goodAfter!.status).toBe("SENT")
  })

  it("reclaims a stale SENDING row and sends it", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const stale = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge",
      status: "SENDING",
      updatedAt: new Date(Date.now() - 30 * 60 * 1000)
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUnique({ where: { id: stale.id } })
    expect(after!.status).toBe("SENT")
  })

  it("leaves a fresh SENDING claim alone", async () => {
    const lead = await createLead({ status: "NO_RESPONSE", marketingConsent: true })
    const fresh = await createScheduledRow({
      leadId: lead.id,
      triggerEvent: "NO_RESPONSE_NUDGE",
      entityType: "LEAD",
      entityId: lead.id,
      templateName: "no_response_nudge",
      status: "SENDING"
    })

    await dispatchDue()

    const after = await prisma.scheduledMessage.findUnique({ where: { id: fresh.id } })
    expect(after!.status).toBe("SENDING")
  })
})
