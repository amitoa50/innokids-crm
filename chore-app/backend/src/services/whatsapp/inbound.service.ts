import prisma from "../../lib/prisma"
import { normalizePhone } from "../../lib/phoneNormalizer"
import { getOrCreateConversation, logMessage } from "../communication.service"
import { findByExternalId, linkExternalId } from "../externalRef.service"
import { logActivity } from "../activityLog.service"
import { createNotification, notifyAdmins } from "../notification.service"
import type { NormalizedInboundMessage, NormalizedStatusUpdate } from "./provider"

const WINDOW_MS = 24 * 60 * 60 * 1000

export async function handleInboundMessage(msg: NormalizedInboundMessage) {
  // Idempotency: a replayed provider message id is ignored
  const existingRef = await findByExternalId("WHATSAPP", msg.externalId)
  if (existingRef) return { skipped: true as const }

  const phoneNormalized = normalizePhone(msg.fromPhone)

  let lead = await prisma.lead.findUnique({ where: { phoneNormalized } })
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        fullName: msg.fromPhone,
        phone: msg.fromPhone,
        phoneNormalized,
        source: "WHATSAPP",
        whatsappConsent: true,
        whatsappConsentAt: new Date()
      }
    })
    await logActivity({
      type: "LEAD_RECEIVED_FROM_SOURCE",
      description: `ליד חדש מוואטסאפ: ${msg.fromPhone}`,
      leadId: lead.id,
      metadata: { source: "WHATSAPP" }
    })
    await notifyAdmins(`הודעת וואטסאפ מליד חדש: ${msg.fromPhone}`)
  }

  // Inbound opens/extends the 24h service window and establishes service-window consent
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      whatsappWindowExpiresAt: new Date(Date.now() + WINDOW_MS),
      whatsappConsent: true,
      whatsappConsentAt: lead.whatsappConsentAt ?? new Date(),
      lastContactDate: new Date()
    }
  })

  const conversation = await getOrCreateConversation({ leadId: lead.id }, "WHATSAPP")
  const message = await logMessage({
    conversationId: conversation.id,
    direction: "INBOUND",
    channel: "WHATSAPP",
    body: msg.body,
    status: "RECEIVED"
  })

  await linkExternalId({
    entityType: "MESSAGE",
    entityId: message.id,
    system: "WHATSAPP",
    externalId: msg.externalId
  })

  if (lead.assignedToId) {
    await createNotification(lead.assignedToId, `הודעת וואטסאפ מ: ${lead.fullName}`)
  }

  return { leadId: lead.id, messageId: message.id }
}

export async function handleStatusUpdate(update: NormalizedStatusUpdate) {
  const ref = await findByExternalId("WHATSAPP", update.externalId)
  if (!ref || ref.entityType !== "MESSAGE") return
  await prisma.message.update({
    where: { id: ref.entityId },
    data: { status: update.status }
  })
}
