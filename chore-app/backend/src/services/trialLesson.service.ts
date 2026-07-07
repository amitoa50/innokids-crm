import prisma from "../lib/prisma"
import { setLeadStatus } from "./lead.service"
import { FOLLOW_UP_AFTER_TRIAL_DELAY_DAYS } from "../lib/pipeline"
import { logActivity } from "./activityLog.service"
import { createNotification } from "./notification.service"
import { enqueue, cancelForEntity } from "./automation.service"

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

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

  // Auto-update lead status to TRIAL_SCHEDULED (validated system transition)
  await setLeadStatus(data.leadId, "TRIAL_SCHEDULED", performedById, { system: true })

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

  // Automation: immediate confirmation + a reminder 24h before the trial
  await enqueue("TRIAL_CONFIRMATION", {
    leadId: data.leadId,
    entityType: "TRIAL_LESSON",
    entityId: trial.id,
    baseTime: new Date(),
    parentName: trial.lead.fullName,
    scheduledAt: trial.scheduledAt
  })
  await enqueue("TRIAL_REMINDER", {
    leadId: data.leadId,
    entityType: "TRIAL_LESSON",
    entityId: trial.id,
    baseTime: trial.scheduledAt,
    parentName: trial.lead.fullName,
    scheduledAt: trial.scheduledAt
  })

  return trial
}

export async function updateTrialLesson(id: number, data: Partial<CreateTrialData>) {
  const trial = await prisma.trialLesson.update({
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

  // Reschedule: refresh the pending confirmation/reminder dueAt in place (idempotent by dedupeKey)
  if (data.scheduledAt) {
    await enqueue("TRIAL_CONFIRMATION", {
      leadId: trial.leadId,
      entityType: "TRIAL_LESSON",
      entityId: id,
      baseTime: new Date(),
      parentName: trial.lead.fullName,
      scheduledAt: trial.scheduledAt
    })
    await enqueue("TRIAL_REMINDER", {
      leadId: trial.leadId,
      entityType: "TRIAL_LESSON",
      entityId: id,
      baseTime: trial.scheduledAt,
      parentName: trial.lead.fullName,
      scheduledAt: trial.scheduledAt
    })
  }

  return trial
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
    include: { lead: { select: { id: true, fullName: true, childName: true, assignedToId: true } } }
  })

  // Auto-update lead status based on trial outcome
  if (status === "COMPLETED") {
    await setLeadStatus(trial.lead.id, "TRIAL_COMPLETED", performedById, { system: true })

    const followUpDate = addDays(new Date(), FOLLOW_UP_AFTER_TRIAL_DELAY_DAYS)
    await prisma.lead.update({
      where: { id: trial.lead.id },
      data: { nextFollowUpDate: followUpDate }
    })

    if (trial.lead.assignedToId) {
      await prisma.task.create({
        data: {
          title: `מעקב אחרי שיעור ניסיון: ${trial.lead.fullName}`,
          type: "FOLLOW_UP",
          assignedToId: trial.lead.assignedToId,
          leadId: trial.lead.id,
          dueDate: followUpDate
        }
      })
    }

    await logActivity({
      type: "TRIAL_COMPLETED",
      description: `שיעור ניסיון הושלם: ${trial.lead.fullName}`,
      leadId: trial.lead.id,
      performedById,
      metadata: { outcome }
    })

    // Automation: drop the now-moot confirmation/reminder, enqueue the post-trial follow-up
    await cancelForEntity("TRIAL_LESSON", id, "TRIAL_COMPLETED")
    await enqueue("POST_TRIAL_FOLLOW_UP", {
      leadId: trial.lead.id,
      entityType: "TRIAL_LESSON",
      entityId: id,
      baseTime: new Date(),
      parentName: trial.lead.fullName,
      childName: trial.lead.childName ?? undefined
    })
  } else if (status === "NO_SHOW") {
    // Auto-stage: lead did not show -> NO_RESPONSE + next-day follow-up
    await setLeadStatus(trial.lead.id, "NO_RESPONSE", performedById, { system: true })

    const followUpDate = addDays(new Date(), 1)
    await prisma.lead.update({
      where: { id: trial.lead.id },
      data: { nextFollowUpDate: followUpDate }
    })

    if (trial.lead.assignedToId) {
      await prisma.task.create({
        data: {
          title: `לא הגיע לשיעור ניסיון - ליצור קשר: ${trial.lead.fullName}`,
          type: "FOLLOW_UP",
          assignedToId: trial.lead.assignedToId,
          leadId: trial.lead.id,
          dueDate: followUpDate
        }
      })
    }

    await logActivity({
      type: "STATUS_CHANGE",
      description: `שיעור ניסיון: לא הגיע - ${trial.lead.fullName}`,
      leadId: trial.lead.id,
      performedById
    })

    // Automation: no-show owns the re-engagement (suppresses the generic no-response nudge)
    await cancelForEntity("TRIAL_LESSON", id, "TRIAL_NO_SHOW")
    await enqueue("TRIAL_NO_SHOW_RESCHEDULE", {
      leadId: trial.lead.id,
      entityType: "TRIAL_LESSON",
      entityId: id,
      baseTime: new Date(),
      parentName: trial.lead.fullName
    })
  } else if (status === "CANCELLED") {
    // Automation: cancel any pending confirmation/reminder for this trial
    await cancelForEntity("TRIAL_LESSON", id, "TRIAL_CANCELLED")
  }

  return trial
}
