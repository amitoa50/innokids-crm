import { Prisma, PrismaClient } from "@prisma/client"
import prisma from "../lib/prisma"

type DbClient = Prisma.TransactionClient | PrismaClient

interface LogActivityParams {
  type: string
  description: string
  leadId?: number
  studentId?: number
  performedById?: number
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams, client: DbClient = prisma) {
  return client.activityLog.create({
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
