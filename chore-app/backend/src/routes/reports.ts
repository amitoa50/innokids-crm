import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)

// GET /stats — Chore statistics
router.get("/stats", async (req: Request, res: Response) => {
  const where: Record<string, unknown> = {}
  if (req.user!.role !== "ADMIN") {
    where.assignedToId = req.user!.userId
  }

  const [totalChores, completedChores, overdueChores, pendingChores] = await Promise.all([
    prisma.chore.count({ where }),
    prisma.chore.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.chore.count({ where: { ...where, status: "OVERDUE" } }),
    prisma.chore.count({ where: { ...where, status: "PENDING" } })
  ])

  res.json({ totalChores, completedChores, overdueChores, pendingChores })
})

// GET /overdue — List overdue chores
router.get("/overdue", async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { status: "OVERDUE" }
  if (req.user!.role !== "ADMIN") {
    where.assignedToId = req.user!.userId
  }

  const chores = await prisma.chore.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  res.json(chores)
})

// GET /history — Completed chores history
router.get("/history", async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20
  const where: Record<string, unknown> = { status: "COMPLETED" }
  if (req.user!.role !== "ADMIN") {
    where.assignedToId = req.user!.userId
  }

  const chores = await prisma.chore.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    },
    orderBy: { completedAt: "desc" },
    take: limit
  })

  res.json(chores)
})

export default router
