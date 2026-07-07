import prisma from "../lib/prisma"
import { registry } from "./automation/registry"
import type { RuleContext } from "./automation/registry"
import { sendWhatsApp } from "./whatsapp/send.service"
import { logActivity } from "./activityLog.service"
import { notifyAdmins } from "./notification.service"

const DISPATCH_BATCH = 50

// Enqueue an automated message into the outbox. Idempotent via dedupeKey:
// a fresh trigger creates a PENDING row; a reschedule updates the pending row's
// dueAt/variables in place; terminal rows (SENT/CANCELLED/FAILED) are never resurrected.
export async function enqueue(triggerEvent: string, ctx: RuleContext) {
  const rule = await prisma.automationRule.findFirst({ where: { triggerEvent, active: true } })
  if (!rule) return
  const def = registry[triggerEvent]
  if (!def) return

  const dueAt = new Date(ctx.baseTime.getTime() + rule.offsetMinutes * 60000)
  const dedupeKey = `${triggerEvent}:${ctx.entityType}:${ctx.entityId}`
  const variables = JSON.stringify(def.resolveVariables(ctx))

  const existing = await prisma.scheduledMessage.findUnique({ where: { dedupeKey } })
  if (existing) {
    if (existing.status === "PENDING") {
      await prisma.scheduledMessage.update({
        where: { dedupeKey },
        data: { dueAt, variables, templateName: rule.templateName }
      })
    }
    return
  }

  await prisma.scheduledMessage.create({
    data: {
      leadId: ctx.leadId,
      channel: rule.channel,
      templateName: rule.templateName,
      variables,
      dueAt,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      dedupeKey,
      status: "PENDING"
    }
  })
}

// Cancel every pending message tied to a triggering entity (trial cancel/complete/no-show).
export async function cancelForEntity(entityType: string, entityId: number, reason: string) {
  await prisma.scheduledMessage.updateMany({
    where: { entityType, entityId, status: "PENDING" },
    data: { status: "CANCELLED", failureReason: reason }
  })
}

async function finalize(id: number, status: string, reason?: string) {
  await prisma.scheduledMessage.update({
    where: { id },
    data: { status, failureReason: reason ?? null }
  })
}

// Drain the outbox: claim due rows, re-check stop conditions + consent + template
// approval at dispatch time, send the template, and record the outcome. Called by
// the 5-minute cron tick. Safe against overlapping ticks via the SENDING claim.
export async function dispatchDue() {
  const now = new Date()
  const due = await prisma.scheduledMessage.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: DISPATCH_BATCH
  })

  for (const row of due) {
    // Atomic claim: only one tick can flip PENDING -> SENDING
    const claim = await prisma.scheduledMessage.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING" }
    })
    if (claim.count !== 1) continue

    const triggerEvent = (row.dedupeKey || "").split(":")[0]
    const def = registry[triggerEvent]
    if (!def) {
      await finalize(row.id, "FAILED", "UNKNOWN_TRIGGER")
      continue
    }

    const lead = await prisma.lead.findUnique({ where: { id: row.leadId } })
    if (!lead) {
      await finalize(row.id, "CANCELLED", "LEAD_NOT_FOUND")
      continue
    }
    if (!lead.whatsappConsent) {
      await finalize(row.id, "CANCELLED", "CONSENT_REVOKED")
      continue
    }

    const check = await def.guard(row, lead)
    if (!check.ok) {
      await finalize(row.id, "CANCELLED", check.reason)
      continue
    }

    const tpl = await prisma.messageTemplate.findUnique({ where: { name: row.templateName } })
    if (!tpl || tpl.status !== "APPROVED") {
      await finalize(row.id, "FAILED", "NO_APPROVED_TEMPLATE")
      await notifyAdmins(`הודעה אוטומטית נכשלה — אין תבנית מאושרת (${row.templateName}) עבור ${lead.fullName}`)
      continue
    }

    const variables = row.variables ? (JSON.parse(row.variables) as string[]) : []
    const result = await sendWhatsApp(row.leadId, { templateName: row.templateName, variables })
    if ("error" in result) {
      await finalize(row.id, "FAILED", result.error)
      await notifyAdmins(`הודעה אוטומטית נכשלה (${result.error}) עבור ${lead.fullName}`)
      continue
    }

    await prisma.scheduledMessage.update({
      where: { id: row.id },
      data: { status: "SENT", messageId: result.message.id, failureReason: null }
    })
    await logActivity({
      type: "WHATSAPP_AUTO_SENT",
      description: `הודעת וואטסאפ אוטומטית נשלחה (${triggerEvent})`,
      leadId: row.leadId,
      metadata: { triggerEvent, templateName: row.templateName }
    })
  }
}
