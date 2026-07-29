import prisma from "../../src/lib/prisma"
import { seedAutomation } from "../../src/lib/automationSeed"

let phoneCounter = 0

// Wipe every table (children before parents) and re-seed automation rules +
// templates, so each test starts from the same known state.
export async function resetDb() {
  await prisma.externalRef.deleteMany()
  await prisma.scheduledMessage.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.trialLesson.deleteMany()
  await prisma.leadIntake.deleteMany()
  await prisma.student.deleteMany()
  await prisma.group.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.user.deleteMany()
  await prisma.automationRule.deleteMany()
  await prisma.messageTemplate.deleteMany()
  await seedAutomation()
}

export async function createAdmin() {
  return prisma.user.create({
    data: { email: "admin@test.local", name: "Test Admin", password: "hashed", role: "ADMIN" }
  })
}

export async function createLead(overrides: Record<string, unknown> = {}) {
  phoneCounter += 1
  const phone = `+97250${String(1000000 + phoneCounter)}`
  return prisma.lead.create({
    data: {
      fullName: "הורה בדיקה",
      phone,
      phoneNormalized: phone,
      whatsappConsent: true,
      ...overrides
    }
  })
}

export async function createTrial(leadId: number, overrides: Record<string, unknown> = {}) {
  return prisma.trialLesson.create({
    data: {
      leadId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: "SCHEDULED",
      ...overrides
    }
  })
}

interface ScheduledRowParams {
  leadId: number
  triggerEvent: string
  entityType: string
  entityId: number
  templateName: string
  variables?: string[]
  dueAt?: Date
  createdAt?: Date
  status?: string
  updatedAt?: Date
}

// Insert an outbox row directly, with an explicit past createdAt by default so
// reply-detection ("inbound after the row's createdAt") is deterministic.
export async function createScheduledRow(params: ScheduledRowParams) {
  return prisma.scheduledMessage.create({
    data: {
      leadId: params.leadId,
      channel: "WHATSAPP",
      templateName: params.templateName,
      variables: JSON.stringify(params.variables ?? ["הורה בדיקה"]),
      dueAt: params.dueAt ?? new Date(Date.now() - 60 * 1000),
      status: params.status ?? "PENDING",
      dedupeKey: `${params.triggerEvent}:${params.entityType}:${params.entityId}`,
      entityType: params.entityType,
      entityId: params.entityId,
      createdAt: params.createdAt ?? new Date(Date.now() - 60 * 60 * 1000),
      ...(params.updatedAt && { updatedAt: params.updatedAt })
    }
  })
}

export async function logWhatsAppMessage(leadId: number, direction: "INBOUND" | "OUTBOUND", body = "הודעה") {
  let conversation = await prisma.conversation.findFirst({ where: { leadId, channel: "WHATSAPP" } })
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId, channel: "WHATSAPP" } })
  }
  return prisma.message.create({
    data: { conversationId: conversation.id, direction, channel: "WHATSAPP", body }
  })
}

export async function createStaff() {
  return prisma.user.create({
    data: { email: "staff@test.local", name: "Test Staff", password: "hashed", role: "STAFF" }
  })
}

export { prisma }
