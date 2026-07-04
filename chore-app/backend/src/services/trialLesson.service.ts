import prisma from "../lib/prisma"
import { logActivity } from "./activityLog.service"
import { createNotification } from "./notification.service"

interface CreateTrialData {
  leadId: number
  groupId?: number
  scheduledAt: string
  teacherId?: number
  notes?: string
}

export async function listTrialLessons(filters: {
  status?: string
  teacherId?: number
  from?: string
  to?: string
}) {
  return prisma.trialLesson.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.teacherId && { teacherId: filters.teacherId }),
      ...(filters.from || filters.to ? {
        scheduledAt: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to) })
        }
      } : {})
    },
    include: {
      lead: { select: { id: true, fullName: true, phone: true } },
      group: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } }
    },
    orderBy: { scheduledAt: "asc" }
  })
}

export async function createTrialLesson(data: CreateTrialData, performedById: number) {
  const trial = await prisma.trialLesson.create({
    data: {
      leadId: data.leadId,
      groupId: data.groupId,
      scheduledAt: new Date(data.scheduledAt),
      teacherId: data.teacherId,
      notes: data.notes
    },
    include: {
      lead: { select: { fullName: true, assignedToId: true } },
      group: { select: { name: true } }
    }
  })

  // Auto-update lead status to TRIAL_SCHEDULED
  await prisma.lead.update({
    where: { id: data.leadId },
    data: { status: "TRIAL_SCHEDULED" }
  })

  await logActivity({
    type: "TRIAL_SCHEDULED",
    description: `שיעור ניסיון נקבע: ${trial.lead.fullName}`,
    leadId: data.leadId,
    performedById,
    metadata: { scheduledAt: data.scheduledAt, groupName: trial.group?.name }
  })

  // Notify assigned staff
  if (trial.lead.assignedToId) {
    await createNotification(
      trial.lead.assignedToId,
      `שיעור ניסיון נקבע ל: ${trial.lead.fullName}`
    )
  }

  return trial
}

export async function updateTrialLesson(id: number, data: Partial<CreateTrialData>) {
  return prisma.trialLesson.update({
    where: { id },
    data: {
      ...(data.groupId !== undefined && { groupId: data.groupId }),
      ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
      ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
      ...(data.notes !== undefined && { notes: data.notes })
    },
    include: {
      lead: { select: { fullName: true } },
      group: { select: { name: true } },
      teacher: { select: { name: true } }
    }
  })
}

export async function updateTrialStatus(
  id: number,
  status: string,
  outcome: string | undefined,
  performedById: number
) {
  const trial = await prisma.trialLesson.update({
    where: { id },
    data: { status, outcome },
    include: { lead: { select: { id: true, fullName: true } } }
  })

  // Auto-update lead status based on trial outcome
  if (status === "COMPLETED") {
    await prisma.lead.update({
      where: { id: trial.lead.id },
      data: { status: "TRIAL_COMPLETED" }
    })

    await logActivity({
      type: "TRIAL_COMPLETED",
      description: `שיעור ניסיון הושלם: ${trial.lead.fullName}`,
      leadId: trial.lead.id,
      performedById,
      metadata: { outcome }
    })
  } else if (status === "NO_SHOW") {
    await logActivity({
      type: "STATUS_CHANGE",
      description: `שיעור ניסיון: לא הגיע - ${trial.lead.fullName}`,
      leadId: trial.lead.id,
      performedById
    })
  }

  return trial
}
