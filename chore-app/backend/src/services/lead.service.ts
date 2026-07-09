import prisma from "../lib/prisma"
import { normalizePhone } from "../lib/phoneNormalizer"
import { canTransition } from "../lib/pipeline"
import { checkGroupCapacity, refreshGroupFullStatus, createGroup } from "./group.service"
import { logActivity } from "./activityLog.service"
import { createNotification, notifyAdmins } from "./notification.service"
import { enqueue } from "./automation.service"

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
  childName?: string
  childBirthYear?: number
  whatsappConsent?: boolean
  marketingConsent?: boolean
  preferredChannel?: string
}

interface NewGroupData {
  name: string
  type: string
  learningFormat: string
  branch?: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  maxCapacity?: number
}

interface ConvertData {
  childName: string
  childBirthYear?: number
  learningFormat: string
  branch?: string
  groupId?: number
  newGroup?: NewGroupData
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

  // Create new lead.
  // WhatsApp consent defaults ON: a lead leaving a phone number is treated as
  // contactable. If they are not on WhatsApp the message simply won't deliver
  // and staff follow up manually. Callers can opt out by passing false.
  const whatsappConsent = data.whatsappConsent ?? true

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
      notes: data.notes,
      childName: data.childName,
      childBirthYear: data.childBirthYear,
      whatsappConsent,
      whatsappConsentAt: whatsappConsent ? new Date() : null,
      marketingConsent: data.marketingConsent ?? false,
      preferredChannel: data.preferredChannel
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

  // A parent who messages us first already has an open window handled by staff;
  // only outbound-source leads get the automated opening message.
  if (lead.source !== "WHATSAPP") {
    const welcomeCtx = {
      leadId: lead.id,
      entityType: "LEAD",
      entityId: lead.id,
      baseTime: new Date(),
      parentName: lead.fullName
    }
    await enqueue("LEAD_WELCOME", welcomeCtx)
    await enqueue("LEAD_WELCOME_FOLLOWUP", welcomeCtx)
  }

  return { lead, action: "SUCCESS" as const }
}

// Shared status setter with transition validation.
// System/auto callers pass { system: true } to skip silently on illegal moves
// and to avoid bumping lastContactDate.
export async function setLeadStatus(
  id: number,
  newStatus: string,
  performedById: number | undefined,
  opts: { system?: boolean; force?: boolean } = {}
) {
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return null

  const oldStatus = lead.status
  // force skips the transition map — staff can move a lead to any stage manually
  // (board drag / dropdown). System auto-callers still skip silently on illegal moves.
  if (!opts.force && !canTransition(oldStatus, newStatus)) {
    if (opts.system) return lead
    return { error: "INVALID_TRANSITION" as const, from: oldStatus, to: newStatus }
  }

  if (oldStatus === newStatus) return lead

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: newStatus,
      ...(opts.system ? {} : { lastContactDate: new Date() })
    }
  })

  await logActivity({
    type: "STATUS_CHANGE",
    description: `סטטוס ליד שונה: ${oldStatus} → ${newStatus}`,
    leadId: id,
    performedById,
    metadata: { oldStatus, newStatus, system: opts.system || false }
  })

  return updated
}

export async function updateLeadStatus(
  id: number,
  newStatus: string,
  performedById: number
) {
  // Manual status change (dropdown / board drag) — staff is in control, any move allowed.
  return setLeadStatus(id, newStatus, performedById, { force: true })
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
  if (lead.status === "CONVERTED") return { error: "ALREADY_CONVERTED" as const }

  // Resolve the target group: create a new one on the fly, or use an existing id.
  // A full group is NOT blocked — staff decides who goes where (over-capacity allowed).
  let targetGroupId = studentData.groupId
  if (studentData.newGroup) {
    const created = await createGroup(studentData.newGroup)
    targetGroupId = created.id
  } else if (studentData.groupId) {
    const capacity = await checkGroupCapacity(studentData.groupId)
    if (!capacity.ok && capacity.reason === "GROUP_NOT_FOUND") {
      return { error: "GROUP_NOT_FOUND" as const }
    }
  }

  const student = await prisma.student.create({
    data: {
      leadId: id,
      childName: studentData.childName,
      childBirthYear: studentData.childBirthYear,
      learningFormat: studentData.learningFormat,
      branch: studentData.branch,
      groupId: targetGroupId
    }
  })

  if (targetGroupId) {
    await refreshGroupFullStatus(targetGroupId)
  }

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

  await enqueue("STUDENT_WELCOME", {
    leadId: id,
    entityType: "STUDENT",
    entityId: student.id,
    baseTime: new Date(),
    parentName: lead.fullName,
    childName: studentData.childName
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
