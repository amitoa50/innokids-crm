import prisma from "../lib/prisma"
import { logActivity } from "./activityLog.service"

interface CreateTaskData {
  title: string
  description?: string
  type?: string
  priority?: string
  dueDate?: string
  assignedToId: number
  leadId?: number
  studentId?: number
}

interface UpdateTaskData {
  title?: string
  description?: string
  type?: string
  priority?: string
  dueDate?: string | null
  assignedToId?: number
  leadId?: number | null
  studentId?: number | null
}

export async function listTasks(filters: {
  status?: string
  assignedToId?: number
  type?: string
  priority?: string
  leadId?: number
  studentId?: number
}) {
  return prisma.task.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.assignedToId && { assignedToId: filters.assignedToId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.leadId && { leadId: filters.leadId }),
      ...(filters.studentId && { studentId: filters.studentId })
    },
    include: {
      assignedTo: { select: { name: true } },
      lead: { select: { id: true, fullName: true } },
      student: { select: { id: true, childName: true } }
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  })
}

export async function createTask(data: CreateTaskData, performedById: number) {
  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type || "GENERAL",
      priority: data.priority || "MEDIUM",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedToId: data.assignedToId,
      leadId: data.leadId,
      studentId: data.studentId
    },
    include: {
      assignedTo: { select: { name: true } },
      lead: { select: { fullName: true } },
      student: { select: { childName: true } }
    }
  })

  if (data.leadId) {
    await logActivity({
      type: "TASK_CREATED",
      description: `משימה נוצרה: ${data.title}`,
      leadId: data.leadId,
      performedById
    })
  }

  return task
}

export async function updateTask(id: number, data: UpdateTaskData) {
  return prisma.task.update({
    where: { id },
    data: {
      ...data,
      dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined
    },
    include: {
      assignedTo: { select: { name: true } },
      lead: { select: { fullName: true } },
      student: { select: { childName: true } }
    }
  })
}

export async function completeTask(id: number, performedById: number) {
  const task = await prisma.task.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date()
    },
    include: {
      lead: { select: { fullName: true } }
    }
  })

  if (task.leadId) {
    await logActivity({
      type: "STATUS_CHANGE",
      description: `משימה הושלמה: ${task.title}`,
      leadId: task.leadId,
      performedById
    })
  }

  return task
}

export async function deleteTask(id: number) {
  return prisma.task.delete({ where: { id } })
}
