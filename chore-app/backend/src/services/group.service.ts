import prisma from "../lib/prisma"

interface CreateGroupData {
  name: string
  type: string
  ageRange?: string
  learningFormat: string
  branch?: string
  dayOfWeek?: string
  time?: string
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

export async function addStudentToGroup(groupId: number, studentId: number) {
  return prisma.student.update({
    where: { id: studentId },
    data: { groupId }
  })
}

export async function removeStudentFromGroup(studentId: number) {
  return prisma.student.update({
    where: { id: studentId },
    data: { groupId: null }
  })
}
