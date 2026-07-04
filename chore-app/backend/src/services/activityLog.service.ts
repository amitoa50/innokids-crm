import prisma from "../lib/prisma"

interface LogActivityParams {
  type: string
  description: string
  leadId?: number
  studentId?: number
  performedById?: number
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams) {
  return prisma.activityLog.create({
    data: {
      type: params.type,
      description: params.description,
      leadId: params.leadId,
      studentId: params.studentId,
      performedById: params.performedById,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null
    }
  })
}
