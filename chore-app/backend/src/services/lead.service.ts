import prisma from "../lib/prisma"
import { normalizePhone } from "../lib/phoneNormalizer"
import { logActivity } from "./activityLog.service"
import { createNotification, notifyAdmins } from "./notification.service"

interface CreateLeadData {
  fullName: string
  phone: string
  email?: string
  source?: string
  campaignName?: string
  learningFormat?: string
  branch?: string
  assignedToId?: number
  notes?: string
}

interface ConvertData {
  childName: string
  childBirthYear?: number
  learningFormat: string
  branch?: string
  groupId?: number
}

export async function createLead(data: CreateLeadData, performedById?: number) {
  const phoneNormalized = normalizePhone(data.phone)

  // Dedup check
  const existing = await prisma.lead.findUnique({
    where: { phoneNormalized }
  })

  if (existing) {
    if (existing.status === "CLOSED") {
      // Reopen closed lead
      const reopened = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          status: "NEW",
          fullName: data.fullName || existing.fullName,
          email: data.email || existing.email,
          source: data.source || existing.source,
          campaignName: data.campaignName || existing.campaignName,
          closedReason: null
        }
      })

      await logActivity({
        type: "LEAD_REOPENED",
        description: `ליד נפתח מחדש: ${reopened.fullName}`,
        leadId: reopened.id,
        performedById,
        metadata: { previousStatus: "CLOSED", source: data.source }
      })

      return { lead: reopened, action: "DUPLICATE_REOPENED" as const }
    }

    // Merge into existing active lead
    const merged = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName || existing.fullName,
        email: data.email || existing.email,
        campaignName: data.campaignName || existing.campaignName,
        learningFormat: data.learningFormat || existing.learningFormat,
        branch: data.branch || existing.branch
      }
    })

    await logActivity({
      type: "LEAD_RECEIVED_FROM_SOURCE",
      description: `ליד כפול מוזג: ${merged.fullName}`,
      leadId: merged.id,
      performedById,
      metadata: { source: data.source, action: "merged" }
    })

    return { lead: merged, action: "DUPLICATE_MERGED" as const }
  }

  // Create new lead
  const lead = await prisma.lead.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      phoneNormalized,
      email: data.email,
      source: data.source || "MANUAL",
      campaignName: data.campaignName,
      learningFormat: data.learningFormat,
      branch: data.branch,
      assignedToId: data.assignedToId,
      notes: data.notes
    }
  })

  await logActivity({
    type: "LEAD_RECEIVED_FROM_SOURCE",
    description: `ליד חדש התקבל: ${lead.fullName}`,
    leadId: lead.id,
    performedById,
    metadata: { source: lead.source }
  })

  await notifyAdmins(`ליד חדש: ${lead.fullName} (${lead.source})`)

  return { lead, action: "SUCCESS" as const }
}

export async function updateLeadStatus(
  id: number,
  newStatus: string,
  performedById: number
) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return null

  const oldStatus = lead.status
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: newStatus,
      lastContactDate: new Date()
    }
  })

  await logActivity({
    type: "STATUS_CHANGE",
    description: `סטטוס ליד שונה: ${oldStatus} → ${newStatus}`,
    leadId: id,
    performedById,
    metadata: { oldStatus, newStatus }
  })

  return updated
}

export async function assignLead(
  id: number,
  staffId: number,
  performedById: number
) {
  const staff = await prisma.user.findUnique({ where: { id: staffId } })
  if (!staff) return null

  const updated = await prisma.lead.update({
    where: { id },
    data: { assignedToId: staffId }
  })

  await logActivity({
    type: "STATUS_CHANGE",
    description: `ליד שויך ל: ${staff.name}`,
    leadId: id,
    performedById,
    metadata: { assignedToId: staffId, assignedToName: staff.name }
  })

  await createNotification(staffId, `ליד חדש שויך אליך: ${updated.fullName}`)

  return updated
}

export async function convertLead(
  id: number,
  studentData: ConvertData,
  performedById: number
) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return null
  if (lead.status === "CONVERTED") return { error: "ALREADY_CONVERTED" }

  const student = await prisma.student.create({
    data: {
      leadId: id,
      childName: studentData.childName,
      childBirthYear: studentData.childBirthYear,
      learningFormat: studentData.learningFormat,
      branch: studentData.branch,
      groupId: studentData.groupId
    }
  })

  await prisma.lead.update({
    where: { id },
    data: { status: "CONVERTED" }
  })

  await logActivity({
    type: "LEAD_CONVERTED",
    description: `ליד הומר לתלמיד: ${studentData.childName}`,
    leadId: id,
    studentId: student.id,
    performedById
  })

  return { student }
}

export async function reopenLead(id: number, performedById: number) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return null
  if (lead.status !== "CLOSED") return { error: "NOT_CLOSED" }

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: "NEW", closedReason: null }
  })

  await logActivity({
    type: "LEAD_REOPENED",
    description: `ליד נפתח מחדש: ${updated.fullName}`,
    leadId: id,
    performedById,
    metadata: { previousStatus: "CLOSED" }
  })

  return updated
}

export async function addNote(id: number, note: string, performedById: number) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return null

  const existingNotes = lead.notes || ""
  const timestamp = new Date().toLocaleString("he-IL")
  const updatedNotes = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`

  const updated = await prisma.lead.update({
    where: { id },
    data: { notes: updatedNotes }
  })

  await logActivity({
    type: "NOTE_ADDED",
    description: `הערה נוספה: ${note.substring(0, 50)}${note.length > 50 ? "..." : ""}`,
    leadId: id,
    performedById
  })

  return updated
}
