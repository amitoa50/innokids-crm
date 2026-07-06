import prisma from "../lib/prisma"

interface LinkExternalIdData {
  entityType: string // LEAD, STUDENT, TRIAL_LESSON, GROUP, MESSAGE, CONVERSATION
  entityId: number
  system: string // META, INSTAGRAM, WEBSITE, WHATSAPP, GOOGLE_CALENDAR
  externalId: string
  metadata?: Record<string, unknown>
}

// Idempotent link on the unique [system, externalId] key.
// Replaying the same external event returns the existing ref instead of duplicating.
export async function linkExternalId(data: LinkExternalIdData) {
  return prisma.externalRef.upsert({
    where: {
      system_externalId: { system: data.system, externalId: data.externalId }
    },
    update: {},
    create: {
      entityType: data.entityType,
      entityId: data.entityId,
      system: data.system,
      externalId: data.externalId,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
    }
  })
}

export async function findByExternalId(system: string, externalId: string) {
  return prisma.externalRef.findUnique({
    where: { system_externalId: { system, externalId } }
  })
}
