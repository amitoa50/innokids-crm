import { Prisma } from "@prisma/client"
import prisma from "../lib/prisma"
import { checkGroupCapacity, refreshGroupFullStatus } from "./group.service"

interface CreateStudentData {
  leadId: number
  childName: string
  childBirthYear?: number
  learningFormat: string
  branch?: string
  groupId?: number
  notes?: string
}

interface UpdateStudentData {
  childName?: string
  childBirthYear?: number
  learningFormat?: string
  branch?: string
  status?: string
  groupId?: number | null
  notes?: string
}

export async function listStudents(filters: {
  status?: string
  groupId?: number
  learningFormat?: string
  search?: string
}) {
  return prisma.student.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.groupId && { groupId: filters.groupId }),
      ...(filters.learningFormat && { learningFormat: filters.learningFormat }),
      ...(filters.search && {
        OR: [
          { childName: { contains: filters.search } },
          { lead: { fullName: { contains: filters.search } } }
        ]
      })
    },
    include: {
      lead: { select: { fullName: true, phone: true, email: true } },
      group: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" }
  })
}

export async function getStudent(id: number) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, fullName: true, phone: true, email: true } },
      group: { select: { id: true, name: true } },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        include: { performedBy: { select: { name: true } } }
      },
      tasks: {
        include: { assignedTo: { select: { name: true } } }
      }
    }
  })
}

export async function createStudent(data: CreateStudentData) {
  try {
    return await prisma.student.create({
      data: {
        leadId: data.leadId,
        childName: data.childName,
        childBirthYear: data.childBirthYear,
        learningFormat: data.learningFormat,
        branch: data.branch,
        groupId: data.groupId,
        notes: data.notes
      },
      include: {
        lead: { select: { fullName: true } },
        group: { select: { name: true } }
      }
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "LEAD_ALREADY_CONVERTED" as const }
    }
    throw e
  }
}

export async function updateStudent(id: number, data: UpdateStudentData) {
  const current = await prisma.student.findUnique({ where: { id } })
  if (!current) return null

  // A direct edit respects capacity like a regular assignment (conversion is the
  // only deliberate overfill path); clearing the group is always allowed.
  const groupChanging = data.groupId !== undefined && data.groupId !== current.groupId
  if (groupChanging && data.groupId != null) {
    const capacity = await checkGroupCapacity(data.groupId)
    if (!capacity.ok) return { error: capacity.reason }
  }

  const student = await prisma.student.update({
    where: { id },
    data,
    include: {
      lead: { select: { fullName: true } },
      group: { select: { name: true } }
    }
  })

  if (groupChanging) {
    if (data.groupId != null) await refreshGroupFullStatus(data.groupId)
    if (current.groupId) await refreshGroupFullStatus(current.groupId)
  }

  return student
}
