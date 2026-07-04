import prisma from "../lib/prisma"

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
  return prisma.student.create({
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
}

export async function updateStudent(id: number, data: UpdateStudentData) {
  return prisma.student.update({
    where: { id },
    data,
    include: {
      lead: { select: { fullName: true } },
      group: { select: { name: true } }
    }
  })
}
