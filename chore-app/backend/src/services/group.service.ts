import prisma from "../lib/prisma"

interface CreateGroupData {
  name: string
  type: string
  ageRange?: string
  learningFormat: string
  branch?: string
  dayOfWeek?: string
  time?: string
  startTime?: string
  endTime?: string
  startDate?: string
  timezone?: string
  maxCapacity?: number
  teacherId?: number
}

interface UpdateGroupData {
  name?: string
  type?: string
  ageRange?: string
  learningFormat?: string
  branch?: string
  dayOfWeek?: string
  time?: string
  startTime?: string
  endTime?: string
  startDate?: string
  timezone?: string
  maxCapacity?: number
  teacherId?: number | null
  status?: string
}

export async function listGroups(filters: {
  status?: string
  learningFormat?: string
  branch?: string
}) {
  return prisma.group.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.learningFormat && { learningFormat: filters.learningFormat }),
      ...(filters.branch && { branch: filters.branch })
    },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { students: true } }
    },
    orderBy: { createdAt: "desc" }
  })
}

export async function getGroup(id: number) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, name: true } },
      students: {
        include: {
          lead: { select: { fullName: true, phone: true } }
        }
      },
      trialLessons: {
        where: { status: "SCHEDULED" },
        include: { lead: { select: { fullName: true } } }
      }
    }
  })
}

export async function createGroup(data: CreateGroupData) {
  return prisma.group.create({
    data,
    include: {
      teacher: { select: { name: true } },
      _count: { select: { students: true } }
    }
  })
}

export async function updateGroup(id: number, data: UpdateGroupData) {
  return prisma.group.update({
    where: { id },
    data,
    include: {
      teacher: { select: { name: true } },
      _count: { select: { students: true } }
    }
  })
}

// Returns { ok: true } when the group can take another student, or a reason otherwise.
export async function checkGroupCapacity(groupId: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { students: true } } }
  })
  if (!group) return { ok: false as const, reason: "GROUP_NOT_FOUND" as const }
  if (group.maxCapacity != null && group._count.students >= group.maxCapacity) {
    return { ok: false as const, reason: "GROUP_FULL" as const }
  }
  return { ok: true as const, count: group._count.students, maxCapacity: group.maxCapacity }
}

// Flips group status to FULL when it reaches capacity after an assignment.
export async function refreshGroupFullStatus(groupId: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { students: true } } }
  })
  if (!group || group.maxCapacity == null) return
  if (group._count.students >= group.maxCapacity && group.status === "ACTIVE") {
    await prisma.group.update({ where: { id: groupId }, data: { status: "FULL" } })
  } else if (group._count.students < group.maxCapacity && group.status === "FULL") {
    await prisma.group.update({ where: { id: groupId }, data: { status: "ACTIVE" } })
  }
}

export async function addStudentToGroup(groupId: number, studentId: number) {
  const capacity = await checkGroupCapacity(groupId)
  if (!capacity.ok) return { error: capacity.reason }

  const student = await prisma.student.update({
    where: { id: studentId },
    data: { groupId }
  })

  await refreshGroupFullStatus(groupId)
  return { student }
}

export async function removeStudentFromGroup(studentId: number) {
  const current = await prisma.student.findUnique({ where: { id: studentId } })
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { groupId: null }
  })

  if (current?.groupId) {
    await refreshGroupFullStatus(current.groupId)
  }
  return student
}
