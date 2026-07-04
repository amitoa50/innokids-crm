import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)

router.get("/dashboard", async (_req: Request, res: Response) => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [newLeads, trialsScheduled, conversions, activeStudents] = await Promise.all([
    prisma.lead.count({
      where: { createdAt: { gte: startOfMonth } }
    }),
    prisma.trialLesson.count({
      where: { status: "SCHEDULED", scheduledAt: { gte: startOfMonth } }
    }),
    prisma.lead.count({
      where: { status: "CONVERTED", updatedAt: { gte: startOfMonth } }
    }),
    prisma.student.count({
      where: { status: "ACTIVE" }
    })
  ])

  res.json({ newLeads, trialsScheduled, conversions, activeStudents })
})

router.get("/pipeline", async (_req: Request, res: Response) => {
  const leads = await prisma.lead.groupBy({
    by: ["status"],
    _count: { id: true }
  })

  const pipeline: Record<string, number> = {}
  for (const item of leads) {
    pipeline[item.status] = item._count.id
  }

  res.json(pipeline)
})

router.get("/source", async (_req: Request, res: Response) => {
  const leads = await prisma.lead.groupBy({
    by: ["source"],
    _count: { id: true }
  })

  const sources: Record<string, number> = {}
  for (const item of leads) {
    sources[item.source] = item._count.id
  }

  res.json(sources)
})

router.get("/staff-performance", requireAdmin, async (_req: Request, res: Response) => {
  const staff = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      role: true,
      _count: {
        select: {
          assignedLeads: true,
          assignedTasks: true
        }
      }
    }
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const performance = await Promise.all(
    staff.map(async (s) => {
      const completedTasks = await prisma.task.count({
        where: {
          assignedToId: s.id,
          status: "COMPLETED",
          completedAt: { gte: startOfMonth }
        }
      })

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        assignedLeads: s._count.assignedLeads,
        assignedTasks: s._count.assignedTasks,
        completedTasksThisMonth: completedTasks
      }
    })
  )

  res.json(performance)
})

export default router
