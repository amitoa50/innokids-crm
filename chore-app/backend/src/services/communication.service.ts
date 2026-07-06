import prisma from "../lib/prisma"
import { logActivity } from "./activityLog.service"

interface LogMessageData {
  conversationId: number
  direction: string // INBOUND, OUTBOUND
  channel: string // WHATSAPP, EMAIL, SMS, PHONE, MANUAL, SYSTEM
  body: string
  sentById?: number
  status?: string
  templateName?: string
}

// Returns the open conversation for a lead on a channel, creating one if needed.
export async function getOrCreateConversation(
  target: { leadId?: number; studentId?: number },
  channel: string
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      leadId: target.leadId ?? undefined,
      studentId: target.studentId ?? undefined,
      channel,
      status: "OPEN"
    }
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      leadId: target.leadId,
      studentId: target.studentId,
      channel
    }
  })
}

export async function logMessage(data: LogMessageData, performedById?: number) {
  const message = await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      direction: data.direction,
      channel: data.channel,
      body: data.body,
      status: data.status || "LOGGED",
      templateName: data.templateName,
      sentById: data.sentById,
      sentAt: data.direction === "OUTBOUND" ? new Date() : undefined
    }
  })

  const conversation = await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { lastMessageAt: new Date() },
    select: { leadId: true, studentId: true }
  })

  await logActivity({
    type: "MESSAGE_LOGGED",
    description: `הודעה ${data.direction === "INBOUND" ? "נכנסת" : "יוצאת"} (${data.channel}): ${data.body.substring(0, 50)}${data.body.length > 50 ? "..." : ""}`,
    leadId: conversation.leadId || undefined,
    studentId: conversation.studentId || undefined,
    performedById
  })

  return message
}

export async function getLeadConversations(leadId: number) {
  return prisma.conversation.findMany({
    where: { leadId },
    include: {
      messages: {
        include: { sentBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { lastMessageAt: "desc" }
  })
}
